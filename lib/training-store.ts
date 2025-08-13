export interface TrainingStatus {
  id: string;
  status: "preparing" | "training" | "completed" | "failed";
  progress: number;
  currentStep: number;
  totalSteps: number;
  logs: string[];
  error?: string;
  startTime: string;
  endTime?: string;
  outputPath?: string;
}

export const trainingStatuses = new Map<string, TrainingStatus>();
export const activeProcesses = new Map<string, any>();
