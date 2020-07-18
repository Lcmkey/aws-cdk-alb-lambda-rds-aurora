import {
  Construct,
  Stack,
  StackProps,
  CfnOutput,
  RemovalPolicy
} from "@aws-cdk/core";
import { ISecretAttachmentTarget } from "@aws-cdk/aws-secretsmanager";
import { StringParameter } from "@aws-cdk/aws-ssm";
import { SecurityGroup } from "@aws-cdk/aws-ec2";
import {
  CfnDBCluster,
  DatabaseSecret,
  CfnDBSubnetGroup
} from "@aws-cdk/aws-rds";
import {
  SecretAttachmentTargetProps,
  AttachmentTargetType
} from "@aws-cdk/aws-secretsmanager";

interface RdssStackProps extends StackProps {
  readonly prefix: string;
  readonly stage: string;
  readonly securityGroup: SecurityGroup;
  readonly dbSubnetGroup: CfnDBSubnetGroup;
}

class RdsStack extends Stack implements ISecretAttachmentTarget {
  public secretArn: string;
  public clusterArn: string;
  public clusterId: string;
  public clusterIdentifier: string;

  constructor(scope: Construct, id: string, props: RdssStackProps) {
    super(scope, id);

    const account = Stack.of(this).account;
    const region = Stack.of(this).region;
    const { prefix, stage, securityGroup, dbSubnetGroup } = props;

    // Create db secret
    const secret = new DatabaseSecret(
      this,
      `${prefix}-${stage}-rds-aurora-credentials`,
      {
        username: "admin"
      }
    );

    this.secretArn = secret.secretArn;

    /**
     * Create Param Group for aurora-mysql
     */

    // const rdsClusterPrameterGroup = new ClusterParameterGroup(
    //   this,
    //   `${prefix}-${stage}-ClusterPrameterGroup`,
    //   {
    //     description: "MySQL 5.7",
    //     family: "aurora-mysql5.7",
    //     parameters: {
    //       max_connections: "100"
    //     }
    //   }
    // );

    // const rdsCluster = new DatabaseCluster(this, "Database", {
    //   engine: DatabaseClusterEngine.AURORA_MYSQL,
    //   engineVersion: "5.7",
    //   instances: 1,
    //   port: 3306,
    //   defaultDatabaseName: "story_books",
    //   removalPolicy: RemovalPolicy.DESTROY,
    //   parameterGroup: rdsClusterPrameterGroup,
    //   masterUser: {
    //     username: secret.secretValueFromJson("username").toString(),
    //     password: secret.secretValueFromJson("password")
    //   },
    //   instanceProps: {
    //     instanceType: InstanceType.of(
    //       InstanceClass.BURSTABLE2,
    //       InstanceSize.SMALL
    //     ),
    //     vpcSubnets: {
    //       subnetType: SubnetType.ISOLATED
    //     },
    //     vpc
    //   }
    // });

    const dbCluster = new CfnDBCluster(
      this,
      `${prefix}-${stage}-apidbcluster`,
      {
        engine: "aurora",
        engineMode: "serverless",
        engineVersion: "5.6",
        databaseName: "story_books",
        masterUsername: secret.secretValueFromJson("username").toString(),
        masterUserPassword: secret.secretValueFromJson("password").toString(),
        port: 3306,
        enableHttpEndpoint: true,
        scalingConfiguration: {
          autoPause: true,
          minCapacity: 1,
          maxCapacity: 2,
          secondsUntilAutoPause: 300
        },
        vpcSecurityGroupIds: [securityGroup.securityGroupId],
        dbSubnetGroupName: dbSubnetGroup.ref,
        // dbSubnetGroupName: dbSubnetGroup.dbSubnetGroupName
        storageEncrypted: true,
        backupRetentionPeriod: 35
      }
    );

    dbCluster.applyRemovalPolicy(RemovalPolicy.DESTROY, {
      applyToUpdateReplacePolicy: true
    });

    //wait for subnet group to be created
    dbCluster.addDependsOn(dbSubnetGroup);

    this.clusterIdentifier = dbCluster.ref;
    this.clusterArn = `arn:aws:rds:${region}:${account}:cluster:${dbCluster.ref}`;
    this.clusterId = `${dbCluster.ref}`;

    /*
     * Cfn Ouput
     */

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

    //
    secret.addTargetAttachment("AttachedSecret", {
      target: this
    });

    // Save Arn to SSM, you can use it in other stack after created
    this.createStringParameter({
      id: `${prefix}-${stage}-aurora-serverless-cluster-arn`,
      name: `${prefix}-${stage}-aurora-serverless-cluster-arn`,
      value: this.clusterArn
    });
    this.createStringParameter({
      id: `${prefix}-${stage}-aurora-serverless-cluster-id`,
      name: `${prefix}-${stage}-aurora-serverless-cluster-id`,
      value: this.clusterId
    });
    this.createStringParameter({
      id: `${prefix}-${stage}-aurora-serverless-secret-arn`,
      name: `${prefix}-${stage}-aurora-serverless-secret-arn`,
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
