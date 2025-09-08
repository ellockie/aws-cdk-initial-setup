import { Stack, StackProps } from "aws-cdk-lib";
import { aws_budgets as budgets } from "aws-cdk-lib";
import { aws_sns as sns } from "aws-cdk-lib";
import { aws_sns_subscriptions as subscriptions } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export interface BudgetAlarmsStackProps extends StackProps {
  budgetLimit?: number;
  numberOfAlarms?: number;
  initialThreshold?: number;
}

export class AwsBudgetAlarmsStack extends Stack {
  private readonly TOTAL_BUDGET_LIMIT_USD: number;
  private readonly NUMBER_OF_ALARMS: number;
  private readonly INITIAL_THRESHOLD: number;

  constructor(scope: Construct, id: string, props?: BudgetAlarmsStackProps) {
    super(scope, id, props);

    // Set defaults or use provided values
    // The total budget limit needs to be higher than your highest alarm.
    // The highest alarm is $0.04 * 2^15 = $1310.72. We'll set the budget a bit higher.
    this.TOTAL_BUDGET_LIMIT_USD = props?.budgetLimit ?? 1500;
    this.NUMBER_OF_ALARMS = props?.numberOfAlarms ?? 16;
    this.INITIAL_THRESHOLD = props?.initialThreshold ?? 0.04;

    // --- Configuration ---
    // Get email from environment variable or use default
    const alertEmailAddress =
      process.env.ALERT_EMAIL_ADDRESS || "your-email@example.com";

    if (alertEmailAddress === "your-email@example.com") {
      console.warn(
        "⚠️  WARNING: Using default email address. Please set ALERT_EMAIL_ADDRESS environment variable."
      );
      throw new Error(
        "ALERT_EMAIL_ADDRESS environment variable not set. Deployment aborted."
      );
    }

    // --- 1. Create a SINGLE SNS Topic for all Notifications ---
    // Both budgets will send alerts here.
    const budgetTopic = new sns.Topic(this, "BudgetAlertsTopic", {
      displayName: "AWS Budget Alerts",
    });

    // --- 2. Create an Email Subscription ---
    // You only need one subscription for the topic.
    budgetTopic.addSubscription(
      new subscriptions.EmailSubscription(alertEmailAddress)
    );

    // --- 3. Generate the 16 Alarm Thresholds ---
    // We will generate all 16, then split them into two arrays.
    const allNotifications = this.generateNotifications(budgetTopic);

    // --- 4. Create the TWO AWS Budget Resources ---
    this.createBudgets(allNotifications);
  }

  private generateNotifications(budgetTopic: sns.Topic) {
    const allNotifications = [];
    let currentThreshold = this.INITIAL_THRESHOLD; // Use local variable

    for (let i = 0; i < this.NUMBER_OF_ALARMS; i++) {
      const thresholdPercentage =
        (currentThreshold / this.TOTAL_BUDGET_LIMIT_USD) * 100;
      allNotifications.push({
        notification: {
          notificationType: "ACTUAL",
          comparisonOperator: "GREATER_THAN",
          threshold: thresholdPercentage,
          thresholdType: "PERCENTAGE",
        },
        subscribers: [
          {
            subscriptionType: "SNS",
            address: budgetTopic.topicArn,
          },
        ],
      });
      currentThreshold *= 2;
    }

    return allNotifications;
  }

  private createBudgets(allNotifications: any[]) {
    // **Budget 1: Contains the first 8 notifications**
    new budgets.CfnBudget(this, "MonthlyAccountBudgetPart1", {
      budget: {
        budgetName: "Total-Monthly-Account-Spend-Budget-Part1",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: {
          amount: this.TOTAL_BUDGET_LIMIT_USD,
          unit: "USD",
        },
      },
      // Slice the first 8 notifications from the main array
      notificationsWithSubscribers: allNotifications.slice(0, 8),
    });

    // **Budget 2: Contains the next 8 notifications**
    new budgets.CfnBudget(this, "MonthlyAccountBudgetPart2", {
      budget: {
        // A slightly different name to avoid conflicts
        budgetName: "Total-Monthly-Account-Spend-Budget-Part2",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: {
          amount: this.TOTAL_BUDGET_LIMIT_USD,
          unit: "USD",
        },
      },
      // Slice the remaining 8 notifications from the main array
      notificationsWithSubscribers: allNotifications.slice(8, 16),
    });
  }
}
