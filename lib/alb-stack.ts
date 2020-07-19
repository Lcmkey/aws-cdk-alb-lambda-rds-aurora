import { Construct, Stack, StackProps, CfnOutput } from "@aws-cdk/core";
import { LambdaTarget } from "@aws-cdk/aws-elasticloadbalancingv2-targets";
import { Function } from "@aws-cdk/aws-lambda";
import { Vpc, SecurityGroup } from "@aws-cdk/aws-ec2";
import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";

interface AlbStackProps extends StackProps {
  readonly prefix: string;
  readonly stage: string;
  readonly vpc: Vpc;
  readonly lambda: Function;
  readonly securityGroup: SecurityGroup;
}

class AlbStack extends Stack {
  constructor(scope: Construct, id: string, props: AlbStackProps) {
    super(scope, id, props);

    const { prefix, stage, vpc, lambda, securityGroup } = props;

    // Create a target group which is used later in Fargate
    // const targetGroup = new ApplicationTargetGroup(this, "TargetGroup", {
    // vpc,
    // port: 80
    // targetType: TargetType.IP
    // protocol: ApplicationProtocol.HTTP
    // });

    // Create public load balancer
    const alb = new ApplicationLoadBalancer(
      this,
      `${prefix}-${stage}-Application-LoadBalancer`,
      {
        vpc,
        internetFacing: true,
        securityGroup
      }
    );

    // and a listener (with certificate!) on port 80
    const listener = alb.addListener("Listener", {
      port: 80
      // defaultTargetGroups: [targetGroup]
    });

    listener.addTargets("Targets", {
      targets: [new LambdaTarget(lambda)]
    });

    new CfnOutput(this, `${prefix}-${stage}-ALB-Http-End-Point`, {
      value: alb.loadBalancerDnsName
    });
  }
}

export { AlbStack };
