import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AwsBudgetAlarmsStack } from "../lib/aws-cdk-initial-setup-stack";

// Add timeout
jest.setTimeout(30000);

describe("Basic Stack Test", () => {
  beforeEach(() => {
    process.env.ALERT_EMAIL_ADDRESS = "test@example.com";
  });

  test("Stack creates without errors", () => {
    const app = new cdk.App();

    expect(() => {
      const stack = new AwsBudgetAlarmsStack(app, "TestStack");
    }).not.toThrow();
  });

  test("Template generates successfully", () => {
    const app = new cdk.App();
    const stack = new AwsBudgetAlarmsStack(app, "TestStack");

    expect(() => {
      const template = Template.fromStack(stack);
    }).not.toThrow();
  });

  test("SNS Topic exists", () => {
    const app = new cdk.App();
    const stack = new AwsBudgetAlarmsStack(app, "TestStack");
    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::SNS::Topic", 1);
  });
});
