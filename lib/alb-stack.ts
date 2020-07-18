import { Construct, Stack, StackProps, CfnOutput } from "@aws-cdk/core";
import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import { LambdaTarget } from "@aws-cdk/aws-elasticloadbalancingv2-targets";
import { Function } from "@aws-cdk/aws-lambda";
import { Vpc, SecurityGroup } from "@aws-cdk/aws-ec2";

interface LoadbalancingStackProps extends StackProps {
  readonly prefix: string;
  readonly stage: string;
  readonly vpc: Vpc;
  readonly lambda: Function;
  readonly securityGroup: SecurityGroup;
}

class LoadbalancingStack extends Stack {
  constructor(scope: Construct, id: string, props: LoadbalancingStackProps) {
    super(scope, id, props);

    const { prefix, stage, vpc, lambda, securityGroup } = props;

    const loadBalancer = new ApplicationLoadBalancer(
      this,
      `${prefix}-${stage}-Application-LoadBalancer`,
      {
        vpc,
        internetFacing: true,
        securityGroup
      }
    );

    const listener = loadBalancer.addListener("Listener", { port: 80 });
    listener.addTargets("Targets", {
      targets: [new LambdaTarget(lambda)]
    });

    new CfnOutput(this, `${prefix}-${stage}-ALB-Http-End-Point`, {
      value: loadBalancer.loadBalancerDnsName
    });
  }
}

export { LoadbalancingStack };
