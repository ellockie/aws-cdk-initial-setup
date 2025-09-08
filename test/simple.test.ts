import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";

// Simple test without importing our stack yet
describe("Simple CDK Test", () => {
  test("CDK App creates", () => {
    const app = new cdk.App();
    expect(app).toBeDefined();
  });

  test("Basic stack works", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "TestStack");
    const template = Template.fromStack(stack);
    expect(template).toBeDefined();
  });
});
