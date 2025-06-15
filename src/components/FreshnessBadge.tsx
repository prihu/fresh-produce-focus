
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { differenceInHours } from 'date-fns';
import { Clock } from 'lucide-react';
import React from "react";

interface FreshnessBadgeProps {
  pickedAt: Date;
}

const FreshnessBadge = ({ pickedAt }: FreshnessBadgeProps) => {
  const hoursAgo = differenceInHours(new Date(), pickedAt);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 cursor-default">
          <Clock className="h-4 w-4" />
          <span>Picked {hoursAgo} hours ago</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Based on warehouse check-in timestamp.</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default FreshnessBadge;
