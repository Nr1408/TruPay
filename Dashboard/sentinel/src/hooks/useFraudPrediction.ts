import { useCallback, useState } from "react";
import {
  DEFAULT_PREDICT_URL,
  type PredictRequestContext,
  predictFraud,
  type PredictionLabel,
} from "@/lib/ml-api";

export function useFraudPrediction() {
  const apiUrl = DEFAULT_PREDICT_URL;
  const [isPredicting, setIsPredicting] = useState(false);

  const predict = useCallback(
    async (
      features: number[],
      requestContext?: PredictRequestContext,
    ): Promise<PredictionLabel> => {
      setIsPredicting(true);
      try {
        return await predictFraud(features, apiUrl, requestContext);
      } finally {
        setIsPredicting(false);
      }
    },
    [apiUrl],
  );

  return {
    apiUrl,
    isPredicting,
    predict,
  };
}
