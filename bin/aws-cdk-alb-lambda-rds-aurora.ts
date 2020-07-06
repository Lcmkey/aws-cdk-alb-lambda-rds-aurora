#!/usr/bin/env node
require("dotenv").config();

import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { VpcStack, RdsStack, LambdaStack } from "./../lib";

// Define aws account / region / rds id && arn
const {
  PREFIX: prefix = "[STACK PREFIX NAME]",
  STAGE: stage = "[DEPLOYMENT STAGE]",
  CDK_ACCOUNT: accountId = "[AWS ACCOUNT ID]",
  CDK_REGION: region = "ap-southeast-1",
  CDK_RDS_INSTANCE_ID: rdsInstanceId = "[RDS DB INSTANCE ID]",
  CDK_RDS_INSTANCE_ARN: rdsInstanceARN = "[RDS DB INSTANCE ARN]"
} = process.env;

// Define aws defulat env config
const env = {
  account: accountId,
  region: region
};

const app = new cdk.App();

const vpcStack = new VpcStack(app, `${prefix}-${stage}-VpcStack`, {
  // env,
  prefix,
  stage
});

const rdsStack = new RdsStack(app, `${prefix}-${stage}-RdsStack`, {
  // env,
  prefix,
  stage,
  vpc: vpcStack.vpc
});

// new LambdaStack(app, "data-api-LambdaStack", { vpc: vpcStack.vpc });

app.synth();
