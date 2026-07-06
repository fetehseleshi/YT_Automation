"use client";

import * as React from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";

export class SectionErrorBoundary extends React.Component<
  { children: React.ReactNode; name?: string },
  { hasError: boolean; message?: string }
> {
  state = { hasError: false, message: undefined as string | undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error("Section error:", this.props.name, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center text-center py-20 px-6">
          <div className="size-14 rounded-2xl bg-rose-500/10 grid place-items-center mb-4">
            <Icon name="alert-triangle" className="size-7 text-rose-500" />
          </div>
          <p className="text-base font-semibold">This section hit a snag</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {this.state.message || "Something went wrong while rendering this section."}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => this.setState({ hasError: false, message: undefined })}
          >
            <Icon name="refresh" className="size-4 mr-1" /> Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
