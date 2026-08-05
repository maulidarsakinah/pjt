import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ChartSkeleton } from "./PageSkeletons";

const FlowAreaChart = lazy(() => import("./FlowAreaChart"));

const DeferredFlowChart = (props) => {
  const containerRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender) {
      return undefined;
    }

    const container = containerRef.current;

    if (!container || !("IntersectionObserver" in window)) {
      setShouldRender(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div ref={containerRef} className="deferred-chart">
      {shouldRender ? (
        <Suspense fallback={<ChartSkeleton />}>
          <FlowAreaChart {...props} />
        </Suspense>
      ) : (
        <ChartSkeleton />
      )}
    </div>
  );
};

export default DeferredFlowChart;
