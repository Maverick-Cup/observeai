import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Key, Webhook, Bell, Shield, User, Mail, Database, Cable, Plug, RefreshCw, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { CONFIG } from "../constants/config";
import { isConvexConfigured } from "../lib/convex";
import { useState } from "react";
import { MOCK_INTEGRATIONS } from "../engine/webhooks/data";
import { testIntegration } from "../engine/webhooks/forwarder";
import type { WebhookIntegration } from "../types/webhooks";

type SettingSection = {
  id: string;
  icon: typeof Key;
  title: string;
  description: string;
  fields: Array<{ label: string; value: string; masked?: boolean }>;
};

const PROVIDER_NAMES: Record<string, string> = {
  dynatrace: "Dynatrace",
  splunk: "Splunk",
  datadog: "DataDog",
  newrelic: "New Relic",
  custom: "Custom Webhook",
};

const SETTINGS_SECTIONS: SettingSection[] = [
  {
    id: "keys",
    icon: Key,
    title: "API Keys",
    description: "Manage integration keys",
    fields: [
      { label: "Production Key", value: "sk-prod-••••••••••••••••", masked: true },
      { label: "Staging Key", value: "sk-staging-••••••••••••••", masked: true },
    ],
  },
  {
    id: "webhooks",
    icon: Webhook,
    title: "Webhooks",
    description: "Endpoint URLs for alerts & data export",
    fields: [
      { label: "Alert Webhook", value: CONFIG.alertWebhookUrl || "https://hooks.example.com/alerts" },
      { label: "Data Export", value: CONFIG.exportWebhookUrl || "https://hooks.example.com/export" },
    ],
  },
  {
    id: "integrations",
    icon: Bell,
    title: "Notifications",
    description: "Slack, PagerDuty, email",
    fields: [
      { label: "Slack Channel", value: "#observeai-alerts" },
      { label: "Email", value: "ops@example.com" },
    ],
  },
  {
    id: "data",
    icon: Database,
    title: "Data Retention",
    description: "Trace storage and export",
    fields: [
      { label: "Retention Period", value: "90 days" },
      { label: "Export Schedule", value: "Daily (UTC 02:00)" },
    ],
  },
  {
    id: "team",
    icon: User,
    title: "Team",
    description: "Members & roles",
    fields: [
      { label: "Organization", value: CONFIG.orgName || "My Org" },
      { label: "Members", value: "3 active" },
    ],
  },
  {
    id: "security",
    icon: Shield,
    title: "Security",
    description: "SSO, audit logs, IP allowlist",
    fields: [
      { label: "SSO", value: "SAML 2.0 • Enabled" },
      { label: "Audit Log Retention", value: "1 year" },
    ],
  },
];

export default function Settings() {
  const configured = isConvexConfigured();
  const [activeTab, setActiveTab] = useState<"general" | "integrations">("general");
  const [integrations, setIntegrations] = useState<WebhookIntegration[]>(MOCK_INTEGRATIONS);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const handleTest = async (integration: WebhookIntegration) => {
    setTestingId(integration.id);
    setTestResult(null);
    const result = await testIntegration(integration);
    setTestResult({
      id: integration.id,
      success: result.success,
      message: result.success
        ? `Connected successfully (${result.latencyMs}ms)`
        : `Failed: ${result.errorMessage ?? "Unknown error"}`,
    });
    setTestingId(null);
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage API keys, integrations, team, and security
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={configured ? "success" : "neutral"}>
            {configured ? "Connected" : "Demo Mode"}
          </Badge>
          <Badge variant="info">v1.0.0</Badge>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "general"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab("integrations")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "integrations"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Cable className="w-4 h-4" />
            Legacy Integrations
          </span>
        </button>
      </div>

      {!configured && activeTab === "general" && (
        <Card additionalClass="mb-6 border-warning/50 bg-warning/5">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-warning mt-0.5" />
            <div>
              <p className="font-medium text-foreground text-sm">Running in Demo Mode</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure your Supabase project and set environment variables to connect to your backend.
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Database className="w-4 h-4" />
              Connect
            </Button>
          </div>
        </Card>
      )}

      {activeTab === "general" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.id}>
                <CardHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span>{section.title}</span>
                    </div>
                  }
                  subtitle={section.description}
                  action={
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  }
                />
                <div className="space-y-3">
                  {section.fields.map((field) => (
                    <div key={field.label} className="flex items-center justify-between py-1.5">
                      <span className="text-xs text-muted-foreground">{field.label}</span>
                      <span className={`text-xs text-foreground font-mono ${field.masked ? "tracking-wider" : ""}`}>
                        {field.value}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Legacy Integrations</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Forward ObserveAI events to your existing observability stack
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Cable className="w-4 h-4" /> Add Integration
            </Button>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              testResult.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}>
              {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{testResult.message}</span>
              <button
                onClick={() => setTestResult(null)}
                className="ml-auto text-xs cursor-pointer hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {integrations.length === 0 ? (
            <Card className="p-8 text-center">
              <Cable className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium">No integrations configured</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Connect Dynatrace, Splunk, DataDog, or New Relic to forward guardrail alerts and trace events.
              </p>
              <Button variant="outline" size="sm">
                <Cable className="w-4 h-4" /> Add Integration
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {integrations.map((integration) => {
                return (
                  <Card key={integration.id}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Plug className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{integration.name}</h3>
                            <p className="text-xs text-muted-foreground">{PROVIDER_NAMES[integration.provider] ?? integration.provider}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={integration.isActive ? "success" : "neutral"}>
                            {integration.isActive ? "Active" : "Disabled"}
                          </Badge>
                          {integration.lastErrorAt && (
                            <Badge variant="error">Error</Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Endpoint</span>
                          <span className="text-foreground font-mono truncate max-w-[200px]">{integration.endpointUrl}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Events</span>
                          <span className="text-foreground">{integration.eventFilters.join(", ")}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Sent / Errors</span>
                          <span className="text-foreground font-mono">
                            {integration.totalSent} / {integration.totalErrors}
                            {integration.lastSentAt && (
                              <span className="text-muted-foreground ml-1">
                                • Last {new Date(integration.lastSentAt).toLocaleDateString()}
                              </span>
                            )}
                          </span>
                        </div>
                        {integration.lastErrorMessage && (
                          <div className="flex items-center gap-1.5 text-xs text-destructive mt-1">
                            <XCircle className="w-3 h-3" />
                            <span>{integration.lastErrorMessage}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleTest(integration)} disabled={testingId === integration.id}>
                          {testingId === integration.id ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> Testing...</>
                          ) : (
                            <><RefreshCw className="w-4 h-4" /> Test</>
                          )}
                        </Button>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" /> Configure
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}