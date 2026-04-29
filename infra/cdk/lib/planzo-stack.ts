import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class PlanzoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // Skeleton only (Week 1): VPC/ECS/RDS/S3/CloudFront come in Week 2+.
    new cdk.CfnOutput(this, "PlanzoInfraStatus", {
      value: "CDK skeleton created"
    });
  }
}

