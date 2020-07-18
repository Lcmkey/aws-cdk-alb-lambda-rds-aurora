import { Construct, Stack, StackProps } from "@aws-cdk/core";
import { Function, Runtime, Code } from "@aws-cdk/aws-lambda";
import { PolicyStatement } from "@aws-cdk/aws-iam";
import { Duration } from "@aws-cdk/core";
import { StringParameter } from "@aws-cdk/aws-ssm";

interface LambdaStackProps extends StackProps {
  readonly prefix: string;
  readonly stage: string;
}

class LambdaStack extends Stack {
  public lambda: Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { prefix, stage } = props;

    // Get Value from SSM Param Store
    const auroraClusterarn = this.getStringParamsFromSsm({
      id: `${prefix}-${stage}-aurora-serverless-cluster-arn`,
      name: `${prefix}-${stage}-aurora-serverless-cluster-arn`
    });
    const auroraClusterid = this.getStringParamsFromSsm({
      id: `${prefix}-${stage}-aurora-serverless-cluster-id`,
      name: `${prefix}-${stage}-aurora-serverless-cluster-id`
    });
    const auroraSecretarn = this.getStringParamsFromSsm({
      id: `${prefix}-${stage}-aurora-serverless-secret-arn`,
      name: `${prefix}-${stage}-aurora-serverless-secret-arn`
    });

    /**
     * Lambda
     */

    const demoLambda = new Function(this, `${prefix}-${stage}-demo`, {
      runtime: Runtime.NODEJS_12_X,
      handler: "demo.handler",
      functionName: `${prefix}-${stage}-api-demo`,
      code: Code.asset("./src/lambda"),
      environment: {
        DBCLUSTERARN: auroraClusterarn,
        DBCLUSTERID: auroraClusterid,
        SECRETARN: auroraSecretarn
      },
      timeout: Duration.seconds(30)
    });

    /**
     * PolicyStatement
     */
    const ssmStatement = new PolicyStatement();
    ssmStatement.addResources(auroraSecretarn);
    ssmStatement.addActions("secretsmanager:GetSecretValue");
    demoLambda.addToRolePolicy(ssmStatement);

    const rdsDataStatement = new PolicyStatement();
    rdsDataStatement.addResources(auroraClusterarn);
    rdsDataStatement.addActions(
      "rds-data:ExecuteStatement",
      "rds-data:BatchExecuteStatement",
      "rds-data:BeginTransaction",
      "rds-data:CommitTransaction",
      "rds-data:RollbackTransaction"
    );
    demoLambda.addToRolePolicy(rdsDataStatement);

    const rdsStatement = new PolicyStatement();
    rdsStatement.addResources(auroraClusterarn);
    rdsStatement.addActions("rds:DescribeDBClusters");
    demoLambda.addToRolePolicy(rdsStatement);

    this.lambda = demoLambda;

    //API GW
    /*
    const rootApi = new apigateway.RestApi(this, 'demo-api', {});
    const integration = new apigateway.LambdaIntegration(demoLambda);

    const demoApi = rootApi.root.addResource('demoapi');

    const demoResource = demoApi.addResource('demo');
    const demoMethod = demoResource.addMethod('GET', integration);
    */
  }

  private getStringParamsFromSsm({
    id,
    name
  }: {
    id: string;
    name: string;
  }): string {
    return StringParameter.fromStringParameterAttributes(this, id, {
      parameterName: name
      // 'version' can be specified but is optional.
    }).stringValue;
  }
}

export { LambdaStack };
