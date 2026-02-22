import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimetableEntry {
  id: number;
  period_number: number;
  start_time: string;
  end_time: string;
  semester: number;
  department: string;
  section: string;
  subject: string;
  is_current: boolean;
  is_past: boolean;
  is_upcoming: boolean;
}

interface TimetableDisplayProps {
  schedule: TimetableEntry[];
  currentDate: string;
}

export default function TimetableDisplay({ schedule, currentDate }: TimetableDisplayProps) {
  if (!schedule || schedule.length === 0) {
    return null; // Don't show anything if no schedule
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <h3 className="text-lg font-bold">Today's Schedule - {formatDate(currentDate)}</h3>
        </div>
        {schedule.length > 0 && (
          <div className="text-xs text-muted-foreground">
            ← Scroll horizontally →
          </div>
        )}
      </div>

      {/* Horizontal Scrollable Container */}
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40">
          {schedule.map((entry) => (
            <Card
              key={entry.id}
              className={cn(
                "flex-shrink-0 w-[350px] shadow-lg snap-start hover:shadow-xl transition-all border-l-4",
                entry.is_current && "border-l-green-500 bg-green-50/50",
                entry.is_past && "border-l-gray-400 bg-gray-50/50 opacity-70",
                entry.is_upcoming && "border-l-blue-500 bg-blue-50/50"
              )}
            >
              <CardHeader className={cn(
                "pb-3 border-b",
                entry.is_current && "bg-gradient-to-r from-green-100/50 to-green-50/30",
                entry.is_past && "bg-gradient-to-r from-gray-100/50 to-gray-50/30",
                entry.is_upcoming && "bg-gradient-to-r from-blue-100/50 to-blue-50/30"
              )}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-bold line-clamp-2">
                      {entry.subject}
                    </CardTitle>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">Period {entry.period_number}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {entry.department}-{entry.section}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Sem {entry.semester}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg shadow-md",
                      entry.is_current && "bg-green-500 text-white",
                      entry.is_past && "bg-gray-400 text-white",
                      entry.is_upcoming && "bg-blue-500 text-white"
                    )}>
                      {entry.period_number}
                    </div>
                    {entry.is_current && (
                      <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                        ACTIVE
                      </Badge>
                    )}
                    {entry.is_past && (
                      <Badge variant="secondary" className="text-xs">
                        Past
                      </Badge>
                    )}
                    {entry.is_upcoming && (
                      <Badge className="bg-blue-500 hover:bg-blue-600 text-xs">
                        Next
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                <div className="bg-muted rounded-lg p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Class Time</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-bold text-lg">{entry.start_time}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-bold text-lg">{entry.end_time}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Duration: {(() => {
                      const [startH, startM] = entry.start_time.split(':').map(Number);
                      const [endH, endM] = entry.end_time.split(':').map(Number);
                      const duration = (endH * 60 + endM) - (startH * 60 + startM);
                      return `${duration} minutes`;
                    })()}
                  </div>
                </div>

                {entry.is_current && (
                  <div className="mt-4 p-3 rounded-lg bg-green-100 border border-green-300">
                    <div className="text-xs font-semibold text-center text-green-800">
                      🟢 This time slot is currently active
                    </div>
                  </div>
                )}
                {entry.is_upcoming && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-100 border border-blue-300">
                    <div className="text-xs font-semibold text-center text-blue-800">
                      ⏰ Upcoming time slot
                    </div>
                  </div>
                )}
                {entry.is_past && (
                  <div className="mt-4 p-3 rounded-lg bg-gray-100 border border-gray-300">
                    <div className="text-xs font-semibold text-center text-gray-700">
                      ⏱️ Past time slot
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
