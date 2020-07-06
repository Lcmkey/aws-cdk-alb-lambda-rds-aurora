import { Construct, Stack, StackProps } from "@aws-cdk/core";
import { Vpc } from "@aws-cdk/aws-ec2";

class VpcStack extends Stack {
  readonly vpc: Vpc;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    //NEW VPC
    const vpc = new Vpc(this, "movpc", {
      cidr: "10.2.0.0/16",
      maxAzs: 2
    });

    this.vpc = vpc;
  }
}

export { VpcStack };
