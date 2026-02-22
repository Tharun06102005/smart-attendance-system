import { Card, CardContent } from "@/components/ui/card";

export default function Timetable() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-serif font-bold text-primary">Academic Timetable</h1>
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Official schedule for current semester</p>
      </div>

      <Card className="overflow-hidden border-none bg-white shadow-lg">
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <img 
              src="/src/assets/timetable.png" 
              alt="Academic Timetable - CSE Department Semester 6" 
              className="w-full h-auto rounded-md border border-gray-200"
              style={{ minWidth: '800px' }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Scroll horizontally to view full timetable on smaller screens
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
