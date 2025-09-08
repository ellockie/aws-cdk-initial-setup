import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import {
  AwsBudgetAlarmsStack,
  BudgetAlarmsStackProps,
} from "../lib/aws-cdk-initial-setup-stack";

// Mock environment variables for testing
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

// Add timeout for all tests
jest.setTimeout(30000);

describe("AwsBudgetAlarmsStack", () => {
  let app: cdk.App;
  let stack: AwsBudgetAlarmsStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    // Set test email to avoid error
    process.env.ALERT_EMAIL_ADDRESS = "test@example.com";
  });

  describe("Default Configuration", () => {
    beforeEach(() => {
      stack = new AwsBudgetAlarmsStack(app, "TestStack");
      template = Template.fromStack(stack);
    });

    test("Creates SNS Topic with correct properties", () => {
      template.hasResourceProperties("AWS::SNS::Topic", {
        DisplayName: "AWS Budget Alerts",
      });
    });

    test("Creates Email Subscription to SNS Topic", () => {
      template.hasResourceProperties("AWS::SNS::Subscription", {
        Protocol: "email",
        Endpoint: "test@example.com",
      });
    });

    test("Creates exactly 2 Budget resources", () => {
      const budgets = template.findResources("AWS::Budgets::Budget");
      expect(Object.keys(budgets)).toHaveLength(2);
    });

    test("Budget Part1 has correct configuration", () => {
      template.hasResourceProperties("AWS::Budgets::Budget", {
        Budget: {
          BudgetName: "Total-Monthly-Account-Spend-Budget-Part1",
          BudgetType: "COST",
          TimeUnit: "MONTHLY",
          BudgetLimit: {
            Amount: 1500,
            Unit: "USD",
          },
        },
      });
    });

    test("Budget Part2 has correct configuration", () => {
      template.hasResourceProperties("AWS::Budgets::Budget", {
        Budget: {
          BudgetName: "Total-Monthly-Account-Spend-Budget-Part2",
          BudgetType: "COST",
          TimeUnit: "MONTHLY",
          BudgetLimit: {
            Amount: 1500,
            Unit: "USD",
          },
        },
      });
    });

    test("Each budget has exactly 8 notifications", () => {
      const budgets = template.findResources("AWS::Budgets::Budget");
      Object.values(budgets).forEach((budget: any) => {
        expect(budget.Properties.NotificationsWithSubscribers).toHaveLength(8);
      });
    });

    test("Notifications have correct threshold progression", () => {
      const budgets = template.findResources("AWS::Budgets::Budget");
      const allNotifications: any[] = [];

      // Collect all notifications from both budgets
      Object.values(budgets).forEach((budget: any) => {
        allNotifications.push(
          ...budget.Properties.NotificationsWithSubscribers
        );
      });

      expect(allNotifications).toHaveLength(16);

      // Check threshold progression (0.04, 0.08, 0.16, etc.)
      const expectedThresholds: number[] = [];
      let threshold = 0.04;
      for (let i = 0; i < 16; i++) {
        expectedThresholds.push((threshold / 1500) * 100); // Convert to percentage
        threshold *= 2;
      }

      allNotifications.forEach((notification, index) => {
        expect(notification.Notification.Threshold).toBeCloseTo(
          expectedThresholds[index],
          5
        );
        expect(notification.Notification.NotificationType).toBe("ACTUAL");
        expect(notification.Notification.ComparisonOperator).toBe(
          "GREATER_THAN"
        );
        expect(notification.Notification.ThresholdType).toBe("PERCENTAGE");
      });
    });

    test("All notifications reference the same SNS Topic", () => {
      const budgets = template.findResources("AWS::Budgets::Budget");
      const snsTopics = template.findResources("AWS::SNS::Topic");
      const topicLogicalId = Object.keys(snsTopics)[0];

      Object.values(budgets).forEach((budget: any) => {
        budget.Properties.NotificationsWithSubscribers.forEach(
          (notification: any) => {
            expect(notification.Subscribers).toHaveLength(1);
            expect(notification.Subscribers[0].SubscriptionType).toBe("SNS");
            expect(notification.Subscribers[0].Address).toEqual({
              Ref: topicLogicalId,
            });
          }
        );
      });
    });
  });

  describe("Custom Configuration", () => {
    test("Accepts custom budget limit", () => {
      const props: BudgetAlarmsStackProps = {
        budgetLimit: 2000,
      };
      stack = new AwsBudgetAlarmsStack(app, "TestStack", props);
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::Budgets::Budget", {
        Budget: {
          BudgetLimit: {
            Amount: 2000,
            Unit: "USD",
          },
        },
      });
    });

    test("Accepts custom number of alarms", () => {
      const props: BudgetAlarmsStackProps = {
        numberOfAlarms: 8,
      };
      stack = new AwsBudgetAlarmsStack(app, "TestStack", props);
      template = Template.fromStack(stack);

      const budgets = template.findResources("AWS::Budgets::Budget");
      const allNotifications: any[] = [];

      Object.values(budgets).forEach((budget: any) => {
        allNotifications.push(
          ...budget.Properties.NotificationsWithSubscribers
        );
      });

      expect(allNotifications).toHaveLength(8);
    });

    test("Accepts custom initial threshold", () => {
      const props: BudgetAlarmsStackProps = {
        initialThreshold: 0.08,
        budgetLimit: 1000,
      };
      stack = new AwsBudgetAlarmsStack(app, "TestStack", props);
      template = Template.fromStack(stack);

      const budgets = template.findResources("AWS::Budgets::Budget");
      const firstBudget = Object.values(budgets)[0] as any;
      const firstNotification =
        firstBudget.Properties.NotificationsWithSubscribers[0];

      // First threshold should be 0.08/1000 * 100 = 0.008%
      expect(firstNotification.Notification.Threshold).toBeCloseTo(0.008, 5);
    });
  });

  describe("Environment Variable Handling", () => {
    test("Throws error when ALERT_EMAIL_ADDRESS is not set", () => {
      delete process.env.ALERT_EMAIL_ADDRESS;

      expect(() => {
        new AwsBudgetAlarmsStack(app, "TestStack");
      }).toThrow(
        "ALERT_EMAIL_ADDRESS environment variable not set. Deployment aborted."
      );
    });

    test("Throws error when ALERT_EMAIL_ADDRESS is default value", () => {
      process.env.ALERT_EMAIL_ADDRESS = "your-email@example.com";

      expect(() => {
        new AwsBudgetAlarmsStack(app, "TestStack");
      }).toThrow(
        "ALERT_EMAIL_ADDRESS environment variable not set. Deployment aborted."
      );
    });

    test("Uses email from environment variable", () => {
      process.env.ALERT_EMAIL_ADDRESS = "myemail@domain.com";
      stack = new AwsBudgetAlarmsStack(app, "TestStack");
      template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SNS::Subscription", {
        Protocol: "email",
        Endpoint: "myemail@domain.com",
      });
    });
  });

  describe("Resource Naming and Structure", () => {
    beforeEach(() => {
      stack = new AwsBudgetAlarmsStack(app, "TestStack");
      template = Template.fromStack(stack);
    });

    test("Creates resources with expected logical IDs", () => {
      // Check that resources exist with predictable naming
      template.hasResource("AWS::SNS::Topic", {});
      template.hasResource("AWS::SNS::Subscription", {});
      template.resourceCountIs("AWS::Budgets::Budget", 2);
    });

    test("Budget names are unique", () => {
      const budgets = template.findResources("AWS::Budgets::Budget");
      const budgetNames = Object.values(budgets).map(
        (budget: any) => budget.Properties.Budget.BudgetName
      );

      expect(budgetNames).toEqual([
        "Total-Monthly-Account-Spend-Budget-Part1",
        "Total-Monthly-Account-Spend-Budget-Part2",
      ]);
    });
  });

  describe("Integration Tests", () => {
    test("Stack synthesizes without errors", () => {
      stack = new AwsBudgetAlarmsStack(app, "TestStack");

      expect(() => {
        app.synth();
      }).not.toThrow();
    });

    test("Generated CloudFormation template is valid", () => {
      stack = new AwsBudgetAlarmsStack(app, "TestStack");
      const cfnTemplate = Template.fromStack(stack).toJSON();

      // Basic CloudFormation structure validation
      expect(cfnTemplate).toHaveProperty("Resources");
      expect(cfnTemplate.Resources).toBeDefined();
      expect(Object.keys(cfnTemplate.Resources)).toHaveLength(4); // Topic, Subscription, 2 Budgets

      // Verify we have the expected resource types
      const resources = cfnTemplate.Resources;
      const resourceTypes = Object.values(resources).map(
        (resource: any) => resource.Type
      );

      expect(resourceTypes).toContain("AWS::SNS::Topic");
      expect(resourceTypes).toContain("AWS::SNS::Subscription");
      expect(
        resourceTypes.filter((type: string) => type === "AWS::Budgets::Budget")
      ).toHaveLength(2);
    });
  });
});
