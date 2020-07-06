import { Construct, Stack, StackProps, CfnOutput } from "@aws-cdk/core";
import { Function, Runtime, Code } from "@aws-cdk/aws-lambda";
import { PolicyStatement } from "@aws-cdk/aws-iam";
import { Duration } from "@aws-cdk/core";
import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import { LambdaTarget } from "@aws-cdk/aws-elasticloadbalancingv2-targets";
import { Vpc, Peer, Port, SecurityGroup } from "@aws-cdk/aws-ec2";
import { StringParameter } from "@aws-cdk/aws-ssm";

interface LambdaStackProps extends StackProps {
  readonly vpc: Vpc;
}

class LambdaStack extends Stack {
  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    // Save Arn to SSM, you can use it in other stack after created
    const auroraClusterarn = StringParameter.fromStringParameterAttributes(
      this,
      "data-Api-Auroraserverless-Cluster-Arn",
      {
        parameterName: "data-api-auroraserverless-clusterarn"
        // 'version' can be specified but is optional.
      }
    ).stringValue;
    const auroraClusterid = StringParameter.fromStringParameterAttributes(
      this,
      "data-api-auroraserverless-cluster-Id",
      {
        parameterName: "data-api-auroraserverless-clusterid"
        // 'version' can be specified but is optional.
      }
    ).stringValue;
    const auroraSecretarn = StringParameter.fromStringParameterAttributes(
      this,
      "data-api-auroraserverless-secret-Arn",
      {
        parameterName: "data-api-auroraserverless-secretarn"
        // 'version' can be specified but is optional.
      }
    ).stringValue;

    //LAMBDA

    const demoLambda = new Function(this, "demo", {
      runtime: Runtime.NODEJS_10_X,
      handler: "demo.handler",
      code: Code.asset("./lambda"),
      environment: {
        DBCLUSTERARN: auroraClusterarn,
        DBCLUSTERID: auroraClusterid,
        SECRETARN: auroraSecretarn
      },
      timeout: Duration.seconds(60)
    });

    const statement1 = new PolicyStatement();
    statement1.addResources(auroraSecretarn);
    statement1.addActions("secretsmanager:GetSecretValue");
    demoLambda.addToRolePolicy(statement1);

    const statement2 = new PolicyStatement();
    statement2.addResources(auroraClusterarn);
    statement2.addActions(
      "rds-data:ExecuteStatement",
      "rds-data:BatchExecuteStatement",
      "rds-data:BeginTransaction",
      "rds-data:CommitTransaction",
      "rds-data:RollbackTransaction"
    );
    demoLambda.addToRolePolicy(statement2);

    const statement3 = new PolicyStatement();
    statement3.addResources(auroraClusterarn);
    statement3.addActions("rds:DescribeDBClusters");
    demoLambda.addToRolePolicy(statement3);

    //API GW
    /*
    const rootApi = new apigateway.RestApi(this, 'demo-api', {});
    const integration = new apigateway.LambdaIntegration(demoLambda);

    const demoApi = rootApi.root.addResource('demoapi');

    const demoResource = demoApi.addResource('demo');
    const demoMethod = demoResource.addMethod('GET', integration);
    */

    //ALB
    const securityGroup = new SecurityGroup(this, "websecurity", {
      vpc,
      allowAllOutbound: false
    });
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

    const loadBalancer = new ApplicationLoadBalancer(this, "LB", {
      vpc,
      internetFacing: true,
      securityGroup: securityGroup
    });

    const listener = loadBalancer.addListener("Listener", { port: 80 });
    listener.addTargets("Targets", {
      targets: [new LambdaTarget(demoLambda)]
    });

    new CfnOutput(this, "ALBHttpEndPoint", {
      value: loadBalancer.loadBalancerDnsName
    });
  }
}

export { LambdaStack };
