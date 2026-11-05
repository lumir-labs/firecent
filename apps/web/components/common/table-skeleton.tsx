import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function TableSkeleton({
  rows,
  columns,
}: {
  rows: number;
  columns: number;
}) {
  const skeletonRows = Array(rows).fill(0);
  const skeletonColumns = Array(columns).fill(0);

  return (
    <div className="flex flex-col border-none">
      {/* Header with search bar and button */}
      <div className="flex flex-wrap gap-2 justify-between items-center w-full mb-4">
        <div className="w-full flex flex-1 h-8 lg:max-w-80 min-w-40 bg-muted border rounded-lg animate-pulse"></div>
        <div className="flex gap-2">
          <div className="w-24 h-8 bg-muted border rounded-lg animate-pulse"></div>
          <div className="w-16 h-8 bg-muted border rounded-lg animate-pulse"></div>
        </div>
      </div>

      {/* Table */}
      <Table>
        {/* Table headers */}
        <TableHeader>
          <TableRow>
            {skeletonColumns.map((_, index) => (
              <TableHead key={index}>
                <div className="w-1/3 min-w-32 p-2 bg-muted rounded-lg animate-pulse"></div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        {/* Data rows */}
        <TableBody>
          {skeletonRows.map((_, index) => (
            <TableRow key={index} className="h-12">
              {skeletonColumns.map((_, index) => (
                <TableCell key={index}>
                  <div className="w-3/4 p-2 bg-muted rounded-lg animate-pulse"></div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
