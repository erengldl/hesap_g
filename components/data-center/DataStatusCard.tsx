import { CircleCheckBig, TriangleAlert, CircleX } from "lucide-react";
import { GlassCard } from "@/components/ui-custom/GlassComponents";

interface DataStatusCardProps {
  title: string;
  status: "active" | "error" | "warning";
  count?: number | null;
  confidence?: string;
  lastUpdate?: string;
}

export function DataStatusCard({ title, status, count, confidence, lastUpdate }: DataStatusCardProps) {
  const isError = status === "error";
  const isWarning = status === "warning";
  const StatusIcon = isError ? CircleX : isWarning ? TriangleAlert : CircleCheckBig;

  return (
    <GlassCard>
      <div className="flex justify-between items-start mb-4">
        <h4 className="font-heading font-semibold text-foreground">{title}</h4>
        <StatusIcon className={`h-4 w-4 ${isError ? "text-destructive" : isWarning ? "text-warning" : "text-primary"}`} />
      </div>
      
      {isError ? (
        <div className="bg-destructive/10 text-destructive text-xs px-2 py-1 rounded w-fit mb-4">
          Kontrol edilemedi
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Kayıt Sayısı:</span>
            <span className="text-foreground font-semibold">{count ?? 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Güven Seviyesi:</span>
            <span className="text-primary">{confidence ?? "Yüksek"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Son Güncelleme:</span>
            <span className="text-foreground">{lastUpdate ?? "Bugün"}</span>
          </div>
        </div>
      )}
      
      <button className="text-sm text-primary hover:text-primary/80 transition-colors duration-200 w-full text-center py-2 border border-primary/20 rounded-xl bg-primary/5">
        Detayları Gör
      </button>
    </GlassCard>
  );
}
