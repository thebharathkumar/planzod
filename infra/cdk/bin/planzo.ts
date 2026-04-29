#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { PlanzoStack } from "../lib/planzo-stack";

const app = new cdk.App();

// TODO: split into staging/prod stacks with environment-specific config.
new PlanzoStack(app, "PlanzoStack", {});
