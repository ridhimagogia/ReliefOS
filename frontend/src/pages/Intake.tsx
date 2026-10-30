import { MessagesTab } from '../intake/MessagesTab'

// One input area. Photo and voice buttons are added to this same box later (same pipeline, same result cards).
export default function Intake() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Intake</h1>
      <MessagesTab />
    </div>
  )
}
