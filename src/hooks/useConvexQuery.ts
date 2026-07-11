import { useState, useEffect, useRef } from "react";
import { convexQuery, isConvexConfigured } from "../lib/convex";

/** Generic hook for fetching data from Convex queries. */
export function useConvexQuery<T = unknown>(
  queryPath: string | null,
  args: Record<string, unknown>,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const argsJson = JSON.stringify(args);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!queryPath || !isConvexConfigured()) {
      setLoading(false);
      return;
    }

    cancelledRef.current = false;
    setLoading(true);

    convexQuery<T>(queryPath, args).then((result) => {
      if (!cancelledRef.current) {
        setData(result);
        setLoading(false);
      }
    });

    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryPath, argsJson]);

  return { data, loading };
}