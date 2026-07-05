import { SkeletonScaffold, SkeletonRows } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold title="Friends" maxWidth="max-w-md">
      <SkeletonRows count={5} />
    </SkeletonScaffold>
  );
}
