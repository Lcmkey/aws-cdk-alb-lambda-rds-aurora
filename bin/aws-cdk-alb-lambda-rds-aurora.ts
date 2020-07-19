#!/usr/bin/env node
require("dotenv").config();

import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { VpcStack, RdsStack, LambdaStack, AlbStack, ElbStack } from "./../lib";

// Define aws account / region / rds id && arn
const {
  PREFIX: prefix = "[STACK PREFIX NAME]",
  STAGE: stage = "[DEPLOYMENT STAGE]",
  CDK_ACCOUNT: accountId = "[AWS ACCOUNT ID]",
  CDK_REGION: region = "ap-southeast-1"
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

new RdsStack(app, `${prefix}-${stage}-RdsStack`, {
  // env,
  prefix,
  stage,
  securityGroup: vpcStack.rdsSecurityGroup,
  subnetGroup: vpcStack.dbSubnetGroup
});

// new CdkAuroraServerlessStack(app, "CdkAuroraServerlessStack", { env });

const lambdaStack = new LambdaStack(app, `${prefix}-${stage}-LambdaStack`, {
  prefix,
  stage
});

new AlbStack(app, `${prefix}-${stage}-AlbStack`, {
  prefix,
  stage,
  vpc: vpcStack.vpc,
  lambda: lambdaStack.lambda,
  securityGroup: vpcStack.lbSecurityGroup
});

new ElbStack(app, `${prefix}-${stage}-ElbStack`, {
  prefix,
  stage,
  vpc: vpcStack.vpc
});

app.synth();
