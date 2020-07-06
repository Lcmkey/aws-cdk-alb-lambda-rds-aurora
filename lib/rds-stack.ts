import { Construct, Stack, StackProps, CfnOutput } from "@aws-cdk/core";
import {
  CfnDBCluster,
  DatabaseSecret,
  CfnDBSubnetGroup,
  DatabaseInstanceEngine
} from "@aws-cdk/aws-rds";
import secretsmanager = require("@aws-cdk/aws-secretsmanager");
import { ISecretAttachmentTarget } from "@aws-cdk/aws-secretsmanager";
import { StringParameter } from "@aws-cdk/aws-ssm";
import { SubnetType } from "@aws-cdk/aws-ec2";

import {
  ISecurityGroup,
  IVpc,
  SecurityGroup,
  SubnetSelection
} from "@aws-cdk/aws-ec2";

interface RdssStackProps extends StackProps {
  readonly vpc: IVpc;
  readonly clusterName: string;
}

class RdsStack extends Stack implements ISecretAttachmentTarget {
  public vpc: IVpc;
  public vpcSubnets: SubnetSelection;
  public securityGroup: ISecurityGroup;
  public securityGroupId: string;

  public secretarn: string;
  public clusterarn: string;
  public clusterid: string;

  constructor(scope: Construct, id: string, props: RdssStackProps) {
    super(scope, id);

    const { vpc, clusterName } = props;

    const secret = new DatabaseSecret(this, "MasterUserSecretDemoDataApi", {
      username: "dbroot"
    });
    this.secretarn = secret.secretArn;

    new CfnOutput(this, "SecretARN", {
      value: secret.secretArn
    });

    const securityGroup = new SecurityGroup(this, "DatabaseSecurityGroup", {
      allowAllOutbound: true,
      description: `DB Cluster (${clusterName}) security group`,
      vpc: vpc
    });
    this.securityGroup = securityGroup;
    this.securityGroupId = securityGroup.securityGroupId;

    const dbcluster = new CfnDBCluster(this, "apidbcluster", {
      engine: "aurora",
      engineMode: "serverless",
      masterUsername: secret.secretValueFromJson("username").toString(),
      masterUserPassword: secret.secretValueFromJson("password").toString(),
      scalingConfiguration: {
        autoPause: true,
        minCapacity: 1,
        maxCapacity: 16,
        secondsUntilAutoPause: 300
      },
      dbSubnetGroupName: new CfnDBSubnetGroup(this, "db-subnet-group", {
        dbSubnetGroupDescription: `${clusterName} database cluster subnet group`,
        subnetIds: vpc.selectSubnets({
          subnetType: SubnetType.PRIVATE
        }).subnetIds
      }).ref
    });

    const region = Stack.of(this).region;
    const account = Stack.of(this).account;

    this.clusterarn = `arn:aws:rds:${region}:${account}:cluster:${dbcluster.ref}`;
    this.clusterid = `${dbcluster.ref}`;

    new CfnOutput(this, "DBClusterARN", {
      value: this.clusterarn
    });
    new CfnOutput(this, "DBClusterDBIdentifier", {
      value: this.clusterid
    });
    secret.addTargetAttachment("AttachedSecret", {
      target: this
    });

    // Save Arn to SSM, you can use it in other stack after created
    new StringParameter(this, `data-Api-auroraserverless-clusterarn`, {
      parameterName: `data-api-auroraserverless-clusterarn`,
      stringValue: this.clusterarn
    });
    new StringParameter(this, `data-Api-auroraserverless-clusterid`, {
      parameterName: `data-api-auroraserverless-clusterid`,
      stringValue: this.clusterid
    });
    new StringParameter(this, `data-Api-auroraserverless-secretarn`, {
      parameterName: `data-api-auroraserverless-secretarn`,
      stringValue: this.secretarn
    });
  }

  public asSecretAttachmentTarget(): secretsmanager.SecretAttachmentTargetProps {
    return {
      targetId: this.clusterarn,
      targetType: secretsmanager.AttachmentTargetType.CLUSTER
    };
  }
}

export { RdsStack };
