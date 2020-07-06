import { Construct, Stack, StackProps } from "@aws-cdk/core";
import { Vpc, SubnetType } from "@aws-cdk/aws-ec2";

interface VpcStackProps extends StackProps {
  readonly prefix: string;
  readonly stage: string;
}

interface subnetConfigurationSchema {
  readonly name: string;
  readonly subnetType: SubnetType;
}

class VpcStack extends Stack {
  readonly vpc: Vpc;
  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    const { prefix, stage } = props;

    const subnetConfiguration = [
      {
        cidrMask: 26,
        name: `${prefix}-${stage}-public-subnet-`,
        subnetType: SubnetType.PUBLIC
      },
      {
        cidrMask: 26,
        name: `${prefix}-${stage}-private-subnet-`,
        subnetType: SubnetType.PRIVATE
      }
    ];

    // Define Vpc
    const vpc = this.createVpc({
      id: `${prefix}-${stage}`,
      cidr: "10.2.0.0/16",
      maxAzs: 2,
      subnet: subnetConfiguration,
      natGateways: 1
    });

    this.vpc = vpc;
  }

  private createVpc({
    id,
    cidr,
    maxAzs,
    subnet,
    natGateways
  }: {
    id: string;
    cidr: string;
    maxAzs: number;
    subnet: Array<subnetConfigurationSchema>;
    natGateways: number;
  }): Vpc {
    return new Vpc(this, `${id}-VpcStack`, {
      cidr,
      maxAzs,
      subnetConfiguration: subnet,
      natGateways
    });
  }
}

export { VpcStack };
