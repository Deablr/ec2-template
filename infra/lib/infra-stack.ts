import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import * as path from "path";
import {Platform} from "@aws-cdk/aws-ecr-assets";
import * as route53 from "aws-cdk-lib/aws-route53";

interface Settings {
  applicationName: string;
  sshIpAddresses: string[];
  keyPairName?: string;
  port: number;
  domainName?: string;
  subdomain?: string;
}

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, settings: Settings, props?: cdk.StackProps) {
    super(scope, settings.applicationName, props);

    // 1. Define the Docker image asset
    // Builds the docker image in the `../app` directory :3
    const imageAsset = new DockerImageAsset(this, `${settings.applicationName}-ImageAsset`, {
      directory: path.join(__dirname, "../../app"),
      // Needed for people building on the awesome apple silicon
      platform: Platform.LINUX_AMD64
    });

    // 2. Get the default VPC, maybe one day I care about custom vpc?
    const vpc = ec2.Vpc.fromLookup(this, "Vpc", { isDefault: true });

    // 3. Create a security group so things can access my app
    const securityGroup = new ec2.SecurityGroup(this, `${settings.applicationName}-Ec2SecurityGroup`, {
      vpc,
      description: "Allow public access to EC2 instance",
      allowAllOutbound: true,
    });
    // Open the provided port to the world for everyone. When I do minecraft I might need to update this to support udp
    securityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(settings.port),
        "Allow public access",
    );

    // Loop over provided addresses (if any) for ssh access. Prevent anyone from ssh'ing into the server. Optional tbh
    for (const ip of settings.sshIpAddresses) {
      securityGroup.addIngressRule(
          ec2.Peer.ipv4(`${ip}/32`),
          ec2.Port.tcp(22),
          "Allow public SSH access",
      );
    }

    // If a keyPairName was created in the EC2 console, we want to set it.
    // If sshIpAddresses has data, this might be bad to have undefined...
    const keyPair = settings.keyPairName ? ec2.KeyPair.fromKeyPairName(this, `${settings.applicationName}-KeyPair`, settings.keyPairName): undefined;

    // 4. Create the EC2 instance
    const instance = new ec2.Instance(this, `${settings.applicationName}-Ec2Instance-${imageAsset.assetHash}`, {
      vpc,
      // This should probably be in the Settings
      instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO,
      ),
      // Why would it be anything else
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      securityGroup: securityGroup,
      keyPair
    });

    // 5. Grant the instance permissions to pull the image from ECR
    imageAsset.repository.grantPull(instance.role);

    // 6. Update the startup script
    instance.addUserData(
        "#!/bin/bash",
        "yum update -y",
        "yum install -y docker",
        "service docker start",
        "chkconfig docker on",
        `aws ecr get-login-password --region ${this.region} | docker login --username AWS --password-stdin ${this.account}.dkr.ecr.${this.region}.amazonaws.com`,
        `docker run -d --name ${settings.applicationName}-container -p ${settings.port}:${settings.port} ${imageAsset.imageUri}`,
    );

    // 7. Output the public IP address of the instance
    new cdk.CfnOutput(this, `${settings.applicationName}-InstancePublicIp`, {
      value: instance.instancePublicIp,
    });

    // Determine whether to setup route53
    if (!settings.domainName || !settings.subdomain) {
      return;
    }

    // 8. Find existing HostedZone. Hope it exists.
    const hostedZone = route53.HostedZone.fromLookup(
        this,
        `${settings.applicationName}-HostedZone`,
        {
          domainName: settings.domainName,
        },
    );

    // 9. Create the A record to point the subdomain to the instance's IP
    new route53.ARecord(this, `${settings.applicationName}-ARecord`, {
      zone: hostedZone,
      recordName: settings.subdomain, // e.g., "app" -> app.deablr.com
      target: route53.RecordTarget.fromIpAddresses(
          instance.instancePublicIp,
      ),
      // The IP will change everytime we redeploy, so might as well keep this tiny
      ttl: cdk.Duration.minutes(1),
    });

    // 10. Output the full url. Do I need to do something for SSL? Maybe.
    new cdk.CfnOutput(this, `${settings.applicationName}-Url`, {
      value: `http://${settings.subdomain}.${settings.domainName}`,
    });
  }
}