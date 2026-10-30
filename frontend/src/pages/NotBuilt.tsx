import { EmptyState } from '../components/States'

export default function NotBuilt({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{name}</h1>
      <EmptyState title="Not available yet" hint="This page is built in a later step." />
    </div>
  )
}
