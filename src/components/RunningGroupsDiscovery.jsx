import { useState, useEffect } from "react";
import { NDK } from "@nostr-dev-kit/ndk";

export function RunningGroupsDiscovery() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRunningGroups() {
      setLoading(true);
      try {
        const ndk = new NDK({
          explicitRelayUrls: [
            "wss://relay.damus.io",
            "wss://nos.lol",
            "wss://relay.nostr.band",
            "wss://nostr.mutinywallet.com",
            "wss://relay.nostrgraph.net",
          ],
        });

        await ndk.connect();

        const filter = {
          kinds: [39000],
          "#t": ["running", "jogging", "marathon", "fitness", "track"],
          limit: 20,
        };

        const events = await ndk.fetchEvents(filter);

        const discoveredGroups = Array.from(events).map((event) => {
          const groupData = JSON.parse(event.content);
          return {
            id: event.id,
            name: groupData.name || "Unnamed Group",
            description: groupData.description || "",
            picture: groupData.picture || "",
            relay: event.relay?.url || groupData.relay || "",
            createdAt: event.created_at,
            memberCount: groupData.member_count || 0,
            tags: event.tags
              .filter((tag) => tag[0] === "t")
              .map((tag) => tag[1]),
          };
        });

        setGroups(discoveredGroups);
      } catch (error) {
        console.error("Error fetching running groups:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRunningGroups();
  }, []);

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Running Communities</h2>
      {loading ? (
        <div>Loading...</div>
      ) : groups.length === 0 ? (
        <div>No running groups found. Try connecting to more relays.</div>
      ) : (
        <ul>
          {groups.map((group) => (
            <li key={group.id}>{group.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}