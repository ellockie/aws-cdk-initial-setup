// Quick test script to verify the stack works
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AwsBudgetAlarmsStack } from "../lib/aws-cdk-initial-setup-stack";

console.log("Setting up test environment...");
process.env.ALERT_EMAIL_ADDRESS = "test@example.com";

try {
  const app = new cdk.App();
  console.log("Creating stack...");
  const stack = new AwsBudgetAlarmsStack(app, "TestStack");

  console.log("Creating template...");
  const template = Template.fromStack(stack);

  console.log("Testing SNS Topic...");
  template.hasResourceProperties("AWS::SNS::Topic", {
    DisplayName: "AWS Budget Alerts",
  });

  console.log("Testing Budget count...");
  template.resourceCountIs("AWS::Budgets::Budget", 2);

  console.log("Getting JSON template...");
  const cfnTemplate = template.toJSON();
  console.log("Template keys:", Object.keys(cfnTemplate));
  console.log(
    "Resources count:",
    Object.keys(cfnTemplate.Resources || {}).length
  );

  console.log("✅ All basic tests passed!");
} catch (error) {
  console.error("❌ Test failed:", error);
  process.exit(1);
}
