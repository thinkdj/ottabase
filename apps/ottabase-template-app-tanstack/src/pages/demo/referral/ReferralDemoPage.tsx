import { useReferral } from "@ottabase/referral";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ottabase/ui-shadcn";
import { useState } from "react";
import { toast } from "sonner";

export function ReferralDemoPage() {
    const {
        referralData,
        referrerCode,
        hasReferral,
        setReferral,
        clearReferral,
        isExpired,
        getTimeRemaining,
    } = useReferral();

    const [customCode, setCustomCode] = useState("");

    const handleSetReferral = () => {
        if (!customCode.trim()) {
            toast.error("Please enter a referral code");
            return;
        }
        setReferral(customCode, { source: "manual", timestamp: Date.now() });
        toast.success(`Referral code "${customCode}" has been set!`);
        setCustomCode("");
    };

    const handleClearReferral = () => {
        clearReferral();
        toast.success("Referral code has been cleared!");
    };

    const formatTimeRemaining = () => {
        const remaining = getTimeRemaining();
        if (!remaining) return "Never expires";
        
        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        
        if (days > 0) {
            return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
        }
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
    };

    return (
        <div className="container mx-auto max-w-4xl py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Referral System Demo</h1>
                <p className="text-muted-foreground">
                    Test the referral system by visiting this page with{" "}
                    <code className="bg-muted px-2 py-1 rounded">?referrer=yourcode</code> in the URL
                </p>
            </div>

            <div className="grid gap-6">
                {/* Current Referral Status */}
                <Card>
                    <CardHeader>
                        <CardTitle>Current Referral Status</CardTitle>
                        <CardDescription>
                            View the active referral code stored in localStorage
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {hasReferral ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
                                    <div>
                                        <div className="text-sm text-muted-foreground mb-1">Referrer Code</div>
                                        <div className="text-2xl font-bold">{referrerCode}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-muted-foreground mb-1">Status</div>
                                        <div className={`text-sm font-semibold ${isExpired() ? 'text-destructive' : 'text-green-600'}`}>
                                            {isExpired() ? "Expired" : "Active"}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-muted rounded-lg">
                                        <div className="text-xs text-muted-foreground mb-1">Captured At</div>
                                        <div className="text-sm font-medium">
                                            {referralData?.capturedAt 
                                                ? new Date(referralData.capturedAt).toLocaleString()
                                                : 'N/A'}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-muted rounded-lg">
                                        <div className="text-xs text-muted-foreground mb-1">Time Remaining</div>
                                        <div className="text-sm font-medium">
                                            {formatTimeRemaining()}
                                        </div>
                                    </div>
                                </div>

                                {referralData?.sourceUrl && (
                                    <div className="p-3 bg-muted rounded-lg">
                                        <div className="text-xs text-muted-foreground mb-1">Source URL</div>
                                        <div className="text-sm font-mono break-all">
                                            {referralData.sourceUrl}
                                        </div>
                                    </div>
                                )}

                                {referralData?.metadata && (
                                    <div className="p-3 bg-muted rounded-lg">
                                        <div className="text-xs text-muted-foreground mb-1">Metadata</div>
                                        <pre className="text-xs overflow-auto">
                                            {JSON.stringify(referralData.metadata, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                <Button 
                                    variant="destructive" 
                                    onClick={handleClearReferral}
                                    className="w-full"
                                >
                                    Clear Referral
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No referral code is currently active.
                                <br />
                                Try visiting with <code className="bg-muted px-2 py-1 rounded">?referrer=john123</code>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Manual Referral Setting */}
                <Card>
                    <CardHeader>
                        <CardTitle>Manually Set Referral</CardTitle>
                        <CardDescription>
                            Set a referral code programmatically (for testing)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Enter referral code"
                                value={customCode}
                                onChange={(e) => setCustomCode(e.target.value)}
                                className="flex-1 px-3 py-2 border rounded-md"
                                onKeyDown={(e) => e.key === 'Enter' && handleSetReferral()}
                            />
                            <Button onClick={handleSetReferral}>
                                Set Referral
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Test Links */}
                <Card>
                    <CardHeader>
                        <CardTitle>Test Links</CardTitle>
                        <CardDescription>
                            Click these links to test referral code detection
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <a
                                href="?referrer=alice2024"
                                className="block p-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                            >
                                <div className="font-medium">Test with alice2024</div>
                                <div className="text-sm text-muted-foreground">?referrer=alice2024</div>
                            </a>
                            <a
                                href="?referrer=bob-promo"
                                className="block p-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                            >
                                <div className="font-medium">Test with bob-promo</div>
                                <div className="text-sm text-muted-foreground">?referrer=bob-promo</div>
                            </a>
                            <a
                                href="?referrer=charlie_xyz"
                                className="block p-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                            >
                                <div className="font-medium">Test with charlie_xyz</div>
                                <div className="text-sm text-muted-foreground">?referrer=charlie_xyz</div>
                            </a>
                        </div>
                    </CardContent>
                </Card>

                {/* Configuration Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Current Configuration</CardTitle>
                        <CardDescription>
                            Active referral provider settings
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Storage Key:</span>
                                <code className="bg-muted px-2 py-1 rounded">ottabase.referral</code>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Query Parameter:</span>
                                <code className="bg-muted px-2 py-1 rounded">referrer</code>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Override Referral:</span>
                                <code className="bg-muted px-2 py-1 rounded">true</code>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Expiry:</span>
                                <code className="bg-muted px-2 py-1 rounded">30 days</code>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Usage Example */}
                <Card>
                    <CardHeader>
                        <CardTitle>Usage Example</CardTitle>
                        <CardDescription>
                            How to use referral codes in your signup flow
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
{`import { useReferral } from "@ottabase/referral";

function SignupForm() {
  const { referrerCode } = useReferral();

  const handleSignup = async (data) => {
    await api.signup({
      ...data,
      referredBy: referrerCode, // Include referral
    });
  };

  return <form onSubmit={handleSignup}>...</form>;
}`}
                        </pre>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
