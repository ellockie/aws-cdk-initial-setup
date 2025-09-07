import { Stack, StackProps, CfnParameter, App } from "aws-cdk-lib";
import { aws_budgets as budgets } from "aws-cdk-lib";
import { aws_sns as sns } from "aws-cdk-lib";
import { aws_sns_subscriptions as subscriptions } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export class AwsBudgetAlarmsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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

    // This is the overall budget limit. It should be higher than your highest alarm threshold.
    // The highest alarm will be $0.04 * 2^15 = $1310.72. We'll set the budget a bit higher.
    const totalBudgetLimitUSD = 1500;

    // --- 1. Create an SNS Topic for Notifications ---
    // All budget alarms will send a message to this single topic.
    const budgetTopic = new sns.Topic(this, "BudgetAlertsTopic", {
      displayName: "AWS Budget Alerts",
    });

    // --- 2. Create an Email Subscription ---
    // This subscribes your email address to the SNS topic.
    // AWS will send you a confirmation email. You MUST click the link in it to activate the subscription.
    budgetTopic.addSubscription(
      new subscriptions.EmailSubscription(alertEmailAddress)
    );

    // --- 3. Generate the 16 Alarm Thresholds ---
    const notifications = [];
    const numberOfAlarms = 16;
    let currentThreshold = 0.04; // Start at 4 cents

    for (let i = 0; i < numberOfAlarms; i++) {
      // The Budgets API uses percentages of the total budget limit for thresholds.
      // So, we calculate what percentage our dollar amount is of the total limit.
      const thresholdPercentage =
        (currentThreshold / totalBudgetLimitUSD) * 100;

      notifications.push({
        // A notification is triggered when ACTUAL spend is GREATER_THAN the threshold.
        notification: {
          notificationType: "ACTUAL",
          comparisonOperator: "GREATER_THAN",
          threshold: thresholdPercentage,
          thresholdType: "PERCENTAGE",
        },
        // It sends the alert to the subscribers of our SNS topic.
        subscribers: [
          {
            subscriptionType: "SNS",
            address: budgetTopic.topicArn,
          },
        ],
      });

      // Double the threshold for the next loop iteration.
      currentThreshold *= 2;
    }

    // --- 4. Create the AWS Budget Resource ---
    // We use the CfnBudget construct (L1) as it provides direct access to the
    // `NotificationsWithSubscribers` property, making it easy to add multiple notifications.
    new budgets.CfnBudget(this, "MonthlyAccountBudget", {
      budget: {
        budgetName: "Total-Monthly-Account-Spend-Budget",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        // Note: The budget limit amount doesn't trigger alerts itself.
        // The notifications we defined above are what trigger the alerts.
        budgetLimit: {
          amount: totalBudgetLimitUSD,
          unit: "USD",
        },
      },
      // Attach all 16 of our generated notifications.
      notificationsWithSubscribers: notifications,
    });
  }
}
