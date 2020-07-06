import { Construct, Stack, StackProps, CfnOutput } from "@aws-cdk/core";
import {
  CfnDBCluster,
  DatabaseSecret,
  CfnDBSubnetGroup
} from "@aws-cdk/aws-rds";
import {
  SecretAttachmentTargetProps,
  AttachmentTargetType
} from "@aws-cdk/aws-secretsmanager";
import { ISecretAttachmentTarget } from "@aws-cdk/aws-secretsmanager";
import { StringParameter } from "@aws-cdk/aws-ssm";
import { SubnetType } from "@aws-cdk/aws-ec2";
import { IVpc } from "@aws-cdk/aws-ec2";

interface RdssStackProps extends StackProps {
  readonly prefix: string;
  readonly stage: string;
  readonly vpc: IVpc;
}

class RdsStack extends Stack implements ISecretAttachmentTarget {
  public secretArn: string;
  public clusterArn: string;
  public clusterId: string;

  constructor(scope: Construct, id: string, props: RdssStackProps) {
    super(scope, id);

    const { prefix, stage, vpc } = props;

    const secret = new DatabaseSecret(
      this,
      `${prefix}-${stage}-rds-aurora-credentials`,
      {
        username: "admin"
      }
    );
    this.secretArn = secret.secretArn;

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
        dbSubnetGroupDescription: `demoapi database cluster subnet group`,
        subnetIds: vpc.selectSubnets({
          subnetType: SubnetType.PRIVATE
        }).subnetIds
      }).ref
    });

    const account = Stack.of(this).account;
    const region = Stack.of(this).region;

    this.clusterArn = `arn:aws:rds:${region}:${account}:cluster:${dbcluster.ref}`;
    this.clusterId = `${dbcluster.ref}`;

    // Cfn Ouput
    this.createCfnOutput({
      id: `${prefix}-${stage}-RDS-SecretARN`,
      value: this.secretArn
    });
    this.createCfnOutput({
      id: `${prefix}-${stage}-RDS-ClusterARN`,
      value: this.clusterArn
    });
    this.createCfnOutput({
      id: `${prefix}-${stage}-RDS-ClusterIdentifier`,
      value: this.clusterId
    });

    secret.addTargetAttachment("AttachedSecret", {
      target: this
    });

    // Save Arn to SSM, you can use it in other stack after created
    this.createStringParameter({
      id: `${prefix}-${stage}-auroraserverless-cluster-arn`,
      name: `${prefix}-${stage}-auroraserverless-cluster-arn`,
      value: this.clusterArn
    });
    this.createStringParameter({
      id: `${prefix}-${stage}-auroraserverless-cluster-id`,
      name: `${prefix}-${stage}-auroraserverless-cluster-id`,
      value: this.clusterId
    });
    this.createStringParameter({
      id: `${prefix}-${stage}-auroraserverless-secretarn`,
      name: `${prefix}-${stage}-auroraserverless-secretarn`,
      value: this.secretArn
    });
  }

  public asSecretAttachmentTarget(): SecretAttachmentTargetProps {
    return {
      targetId: this.clusterArn,
      targetType: AttachmentTargetType.CLUSTER
    };
  }

  // Create Cloudformation Output
  private createCfnOutput({ id, value }: { id: string; value: string }) {
    new CfnOutput(this, id, { value });
  }

  // Create String Parameter (SSM)
  private createStringParameter({
    id,
    name,
    value
  }: {
    id: string;
    name: string;
    value: string;
  }) {
    new StringParameter(this, id, {
      parameterName: name,
      stringValue: value
    });
  }
}

export { RdsStack };
