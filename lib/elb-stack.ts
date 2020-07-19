import { Construct, Stack, StackProps } from "@aws-cdk/core";
import { AutoScalingGroup } from "@aws-cdk/aws-autoscaling";
import { LoadBalancer } from "@aws-cdk/aws-elasticloadbalancing";
import {
  Vpc,
  InstanceType,
  InstanceClass,
  InstanceSize,
  AmazonLinuxImage
} from "@aws-cdk/aws-ec2";

interface ElbStackProps extends StackProps {
  readonly prefix: string;
  readonly stage: string;
  readonly vpc: Vpc;
}

class ElbStack extends Stack {
  constructor(scope: Construct, id: string, props: ElbStackProps) {
    super(scope, id, props);

    const { prefix, stage, vpc } = props;

    const asg = new AutoScalingGroup(
      this,
      `${prefix}-${stage}-Auto-Scalling-Group`,
      {
        autoScalingGroupName: `${prefix}-${stage}-Auto-Scalling-Group`,
        vpc,
        instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
        machineImage: new AmazonLinuxImage()
      }
    );

    const lb = new LoadBalancer(this, `${prefix}-${stage}-Load-Balancer`, {
      vpc,
      internetFacing: true,
      healthCheck: {
        port: 80
      }
    });

    lb.addTarget(asg);
    const listener = lb.addListener({ externalPort: 80 });

    listener.connections.allowDefaultPortFromAnyIpv4("Open to the world");
  }
}

export { ElbStack };
