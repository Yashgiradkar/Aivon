"use client";

import { useState } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  ShieldCheckIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  SparklesIcon,
  ScaleIcon,
  FileTextIcon,
  ThumbsUpIcon,
  FlagIcon,
} from "lucide-react";

export const EvaluationsView = () => {
  const [filterMode, setFilterMode] = useState<"all" | "needsReview">("all");
  const [selectedEvaluation, setSelectedEvaluation] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const metrics = useQuery(api.private.evaluations.getSummaryMetrics);
  const evaluations = usePaginatedQuery(
    api.private.evaluations.list,
    {
      needsReviewOnly: filterMode === "needsReview",
    },
    { initialNumItems: 20 }
  );

  const submitReview = useMutation(api.private.evaluations.submitHumanReview);

  const handleOpenReview = (record: any) => {
    setSelectedEvaluation(record);
    setReviewNotes(record.humanReviewNotes || "");
  };

  const handleReviewAction = async (status: "approved" | "flagged") => {
    if (!selectedEvaluation) return;
    setIsSubmitting(true);
    try {
      await submitReview({
        evaluationId: selectedEvaluation._id as Id<"evaluations">,
        status,
        notes: reviewNotes,
      });
      setSelectedEvaluation(null);
    } catch (err) {
      console.error("Failed to submit review:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ScaleIcon className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">AI Quality & LLM-as-a-Judge</h1>
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
            Rubric v2026.1
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Continuous automated quality auditing of retrieval relevance, answer faithfulness, evidence citations, and support policy compliance.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Avg Faithfulness</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center justify-between">
              {metrics ? `${metrics.averageFaithfulness} / 5` : "..."}
              <ShieldCheckIcon className="size-5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Evidence groundedness
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Answer Relevance</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center justify-between">
              {metrics ? `${metrics.averageAnswerRelevance} / 5` : "..."}
              <SparklesIcon className="size-5 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            User intent fulfillment
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Context Relevance</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center justify-between">
              {metrics ? `${metrics.averageContextRelevance} / 5` : "..."}
              <FileTextIcon className="size-5 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            RAG retrieval precision
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Citation Pass Rate</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center justify-between">
              {metrics ? `${metrics.citationPassRate}%` : "..."}
              <CheckCircle2Icon className="size-5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Verified source attribution
          </CardContent>
        </Card>

        <Card className="bg-card border-amber-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Needs Human Review</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center justify-between text-amber-600">
              {metrics ? metrics.needsReviewCount : "..."}
              <AlertTriangleIcon className="size-5 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Flagged interactions
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg">Evaluated Interactions</CardTitle>
            <CardDescription className="text-xs">
              Review judge dimension scores, citation support, and operator inspection trails.
            </CardDescription>
          </div>
          <Tabs
            value={filterMode}
            onValueChange={(val) => setFilterMode(val as "all" | "needsReview")}
          >
            <TabsList>
              <TabsTrigger value="all" className="text-xs">All Records</TabsTrigger>
              <TabsTrigger value="needsReview" className="text-xs">Needs Review</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="min-w-[200px]">Customer Prompt</TableHead>
                <TableHead className="w-[120px]">Faithfulness</TableHead>
                <TableHead className="w-[120px]">Relevance</TableHead>
                <TableHead className="w-[100px]">Citations</TableHead>
                <TableHead className="w-[110px]">Review Status</TableHead>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead className="w-[90px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-sm">
                    No evaluation records found yet. AI interactions will be continuously audited here.
                  </TableCell>
                </TableRow>
              ) : (
                evaluations.results.map((record: any) => (
                  <TableRow key={record._id}>
                    <TableCell>
                      {record.status === "completed" ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                          Audited
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                          {record.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-xs max-w-xs truncate">
                      {record.userQuestion}
                    </TableCell>
                    <TableCell>
                      {record.scores ? (
                        <Badge variant={record.scores.faithfulness.score >= 4 ? "secondary" : "destructive"} className="text-xs">
                          {record.scores.faithfulness.score} / 5
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {record.scores ? (
                        <Badge variant={record.scores.answerRelevance.score >= 4 ? "secondary" : "destructive"} className="text-xs">
                          {record.scores.answerRelevance.score} / 5
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {record.scores?.citationValidity.pass ? (
                        <Badge variant="outline" className="text-emerald-600 text-xs">Pass</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Fail</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.humanReviewStatus === "approved" && (
                        <span className="text-xs text-emerald-600 font-medium">Approved</span>
                      )}
                      {record.humanReviewStatus === "flagged" && (
                        <span className="text-xs text-red-500 font-medium">Flagged</span>
                      )}
                      {record.humanReviewStatus === "pending" && (
                        <span className="text-xs text-amber-500 font-medium">Pending Review</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(record.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleOpenReview(record)}
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Side-by-Side Inspection & Review Dialog */}
      <Dialog open={!!selectedEvaluation} onOpenChange={(open) => !open && setSelectedEvaluation(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScaleIcon className="size-5 text-primary" />
              Evaluation Inspection & Evidence Audit
            </DialogTitle>
            <DialogDescription className="text-xs">
              Judge Model: {selectedEvaluation?.judgeModel || "gpt-4o-mini"} · Rubric: {selectedEvaluation?.rubricVersion || "v2026.1"}
            </DialogDescription>
          </DialogHeader>

          {selectedEvaluation && (
            <div className="flex flex-col gap-4 py-2 text-sm">
              {/* Question & Answer Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg border">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Customer Question</div>
                  <div className="text-sm font-medium">{selectedEvaluation.userQuestion}</div>
                </div>
                <div className="p-3 bg-muted rounded-lg border">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">AI Agent Answer</div>
                  <div className="text-sm">{selectedEvaluation.agentAnswer}</div>
                </div>
              </div>

              {/* Retrieved Evidence */}
              <div className="p-3 bg-muted/60 rounded-lg border">
                <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <FileTextIcon className="size-3.5" />
                  Retrieved Knowledge Base Context
                </div>
                <div className="text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto text-muted-foreground">
                  {selectedEvaluation.retrievedEvidence || "No RAG context recorded for this interaction."}
                </div>
              </div>

              {/* Rubric Dimension Scores */}
              {selectedEvaluation.scores && (
                <div className="flex flex-col gap-2 border rounded-lg p-3">
                  <div className="text-xs font-semibold mb-2">Evaluator Dimension Scores & Rationale</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-2 bg-background rounded border">
                      <div className="font-semibold flex items-center justify-between">
                        Faithfulness: <span>{selectedEvaluation.scores.faithfulness.score}/5</span>
                      </div>
                      <div className="text-muted-foreground mt-1">{selectedEvaluation.scores.faithfulness.rationale}</div>
                    </div>
                    <div className="p-2 bg-background rounded border">
                      <div className="font-semibold flex items-center justify-between">
                        Answer Relevance: <span>{selectedEvaluation.scores.answerRelevance.score}/5</span>
                      </div>
                      <div className="text-muted-foreground mt-1">{selectedEvaluation.scores.answerRelevance.rationale}</div>
                    </div>
                    <div className="p-2 bg-background rounded border">
                      <div className="font-semibold flex items-center justify-between">
                        Context Relevance: <span>{selectedEvaluation.scores.contextRelevance.score}/5</span>
                      </div>
                      <div className="text-muted-foreground mt-1">{selectedEvaluation.scores.contextRelevance.rationale}</div>
                    </div>
                    <div className="p-2 bg-background rounded border">
                      <div className="font-semibold flex items-center justify-between">
                        Completeness: <span>{selectedEvaluation.scores.completeness.score}/5</span>
                      </div>
                      <div className="text-muted-foreground mt-1">{selectedEvaluation.scores.completeness.rationale}</div>
                    </div>
                    <div className="p-2 bg-background rounded border">
                      <div className="font-semibold flex items-center justify-between">
                        Citations: <span>{selectedEvaluation.scores.citationValidity.pass ? "Pass" : "Fail"}</span>
                      </div>
                      <div className="text-muted-foreground mt-1">{selectedEvaluation.scores.citationValidity.rationale}</div>
                    </div>
                    <div className="p-2 bg-background rounded border">
                      <div className="font-semibold flex items-center justify-between">
                        Policy Compliance: <span>{selectedEvaluation.scores.policyCompliance.pass ? "Pass" : "Fail"}</span>
                      </div>
                      <div className="text-muted-foreground mt-1">{selectedEvaluation.scores.policyCompliance.rationale}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Human Review Section */}
              <div className="flex flex-col gap-2 pt-2 border-t">
                <div className="text-xs font-semibold">Human Operator Review & Notes</div>
                <Textarea
                  placeholder="Add feedback or corrective guidance for this interaction..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="text-xs h-20"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEvaluation(null)}
              className="text-xs"
            >
              Close
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={isSubmitting}
                onClick={() => handleReviewAction("flagged")}
                className="text-xs flex items-center gap-1"
              >
                <FlagIcon className="size-3.5" />
                Flag Concern
              </Button>
              <Button
                size="sm"
                disabled={isSubmitting}
                onClick={() => handleReviewAction("approved")}
                className="text-xs flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <ThumbsUpIcon className="size-3.5" />
                Approve Quality
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
