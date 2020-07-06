#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { VpcStack } from "./../lib/vpc-stack";
import { RdsStack } from "./../lib/rds-stack";
import { LambdaStack } from "../lib/lambda-stack";

const app = new cdk.App();

const vpcStack = new VpcStack(app, "data-api-VpcStack");

const rdsStack = new RdsStack(app, "data-api-RdslStack", {
  vpc: vpcStack.vpc,
  clusterName: "demoapi"
});

new LambdaStack(app, "data-api-LambdaStack", { vpc: vpcStack.vpc });

app.synth();
