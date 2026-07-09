import {
  SkeletonScaffold,
  SkeletonHeading,
  SkeletonRows,
} from "@/components/page-skeleton";

export default function Loading() {
  return (
    <SkeletonScaffold>
      <SkeletonHeading width="w-32" />
      <SkeletonRows count={5} />
    </SkeletonScaffold>
  );
}
