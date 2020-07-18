import { Construct, Stack, StackProps, CfnOutput } from "@aws-cdk/core";
import { Vpc, SubnetType, SecurityGroup, Peer, Port } from "@aws-cdk/aws-ec2";
import { CfnDBSubnetGroup } from "@aws-cdk/aws-rds";

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
  readonly rdsSecurityGroup: SecurityGroup;
  readonly lbSecurityGroup: SecurityGroup;
  readonly dbSubnetGroup: CfnDBSubnetGroup;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    const { prefix, stage } = props;

    const subnetConfiguration = [
      {
        cidrMask: 26,
        name: `${prefix}-${stage}-public-subnet-`,
        subnetType: SubnetType.PUBLIC
      },
      // {
      //   cidrMask: 26,
      //   name: `${prefix}-${stage}-private-subnet-`,
      //   subnetType: SubnetType.PRIVATE
      // },
      {
        cidrMask: 26,
        name: `${prefix}-${stage}-isolated-`,
        subnetType: SubnetType.ISOLATED
      }
    ];

    // Define Vpc
    const vpc = this.createVpc({
      id: `${prefix}-${stage}`,
      cidr: "10.2.0.0/16",
      maxAzs: 2,
      subnet: subnetConfiguration,
      natGateways: 0
    });

    /**
     * Security Group
     */
    const rdsSecurityGroup = this.createSecurityGroup({
      id: `${prefix}-${stage}-Aurora-SecurityGroup`,
      name: `${prefix}-${stage}-Aurora-Sg`,
      vpc,
      allowAllOutbound: true
    });
    const lbSecurityGroup = this.createSecurityGroup({
      id: `${prefix}-${stage}-LB-SecurityGroup`,
      name: `${prefix}-${stage}-LB-Sg`,
      vpc,
      allowAllOutbound: false
    });

    lbSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

    // const subnetIds: string[] = [];
    // vpc.isolatedSubnets.forEach((subnet, index) => {
    //   subnetIds.push(subnet.subnetId);
    // });
    const subnetIds = vpc.selectSubnets({
      subnetType: SubnetType.ISOLATED
    }).subnetIds;

    /**
     * Subnet Group
     */

    const dbSubnetGroup: CfnDBSubnetGroup = new CfnDBSubnetGroup(
      this,
      `${prefix}-${stage}-Aurora-Subnet-Group`,
      {
        dbSubnetGroupName: `${prefix.toLowerCase()}-${stage.toLowerCase()}-serverless-subnet-group`,
        dbSubnetGroupDescription: "Subnet group to access aurora",
        subnetIds
      }
    );

    /**
     * Cfn Ouput
     */

    this.createCfnOutput({
      id: `${prefix}-${stage}-Vpc-Isolated-Subnet-Ids`,
      value: JSON.stringify(subnetIds)
    });
    this.createCfnOutput({
      id: `${prefix}-${stage}-Vpc-Default-Security-Group`,
      value: vpc.vpcDefaultSecurityGroup
    });

    this.vpc = vpc;
    this.rdsSecurityGroup = rdsSecurityGroup;
    this.dbSubnetGroup = dbSubnetGroup;
  }

  // Create Cloudformation Output
  private createCfnOutput({ id, value }: { id: string; value: string }) {
    new CfnOutput(this, id, { value });
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

  private createSecurityGroup({
    id,
    name,
    vpc,
    allowAllOutbound
  }: {
    id: string;
    name: string;
    vpc: Vpc;
    allowAllOutbound: boolean;
  }): SecurityGroup {
    const securityGroup = new SecurityGroup(this, id, {
      vpc,
      securityGroupName: name,
      allowAllOutbound
    });

    return securityGroup;
  }
}

export { VpcStack };
