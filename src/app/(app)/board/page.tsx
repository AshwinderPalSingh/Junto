import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardController } from "@/controllers/board.controller";
import { BoardView } from "@/views/screens/board/board-view";
import { FeedSkeleton } from "@/views/components/skeletons";

export const metadata: Metadata = { title: "Board" };

/** Router: GET /board → BoardController.index → BoardView */
export default function BoardPage({ searchParams }: PageProps<"/board">) {
  return (
    <Suspense fallback={<FeedSkeleton withHeader />}>
      <BoardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function BoardContent({ searchParams }: Pick<PageProps<"/board">, "searchParams">) {
  const vm = await BoardController.index(searchParams);
  return <BoardView vm={vm} />;
}
