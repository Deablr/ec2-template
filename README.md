# Ec2 Template App

This is a blank project for CDK development with TypeScript.

# Prerequisites
- Installed Nodejs
- Installed the cdk globally (`npm i -g aws-cdk`)
- Installed aws cli
- Have a working Docker image
- Have configured an aws profile (`aws configure`)

# Structure
my-project/
├── app/              # Your Docker application code
│   └── Dockerfile
└── infra/            # All AWS CDK infrastructure code
    ├── bin/
    │   └── infra.ts  # Entrypoint: Define your apps here
    └── lib/
        └── infra-stack.ts # The reusable stack definition

## Initial Setup
For first time running within an aws account, run the bootstrap command:
* `cdk bootstrap`

## Useful CDK commands
Run the following commands within the infra directory:

* `cdk deploy`  deploy this stack to your default AWS account/region
* `cdk diff`    compare deployed stack with current state
* `cdk synth`   emits the synthesized CloudFormation template

## Configuration
All application deployments are defined in the infra/bin/infra.ts file. You can configure one or more applications here.
```typescript
const app1Settings = {
  // The name of your app.
  applicationName: "app",

  // Your public home IP address for SSH access.
  sshIpAddresses: ["YOUR_IP_ADDRESS"],

  // The name of the EC2 Key Pair you created in the AWS Console.
  keyPairName: "cdk-ec2-key",

  // The port your container exposes.
  port: 80,

  // Your domain name, which must have a Hosted Zone in Route 53.
  domainName: "deablr.com",

  // The subdomain to create. This will result in "app.deablr.com".
  subdomain: "app",
};
```

## Deploying changes
Whenever changes are made it the app directory, run `cdk deploy` to rebuild the stack.