import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+m - 1]} ${+day}, ${y}`;
}

function parseTags(str) {
  if (!str) return [];
  return str.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

export default function App({ user, teamId, onSignOut }) {
  const C = {
    green: '#1a4a2e', greenLight: '#4a9e6a', greenPale: '#e8f2ec',
    greenBorder: '#b8d9c4', cream: '#faf8f4', paper: '#f4f1eb',
    sand: '#e4ddd0', white: '#ffffff', ink: '#1a1a14',
    inkLight: '#6a6a58', inkFaint: '#9a9a88',
    red: '#8a2a2a', redPale: '#fdf0f0',
    teal: '#1a5a6e', tealPale: '#e8f4f8', tealBorder: '#a0cedd', tealLight: '#3a9abf',
  };
  const FONTS = {
    display: "'Playfair Display', Georgia, serif",
    sans: "'Instrument Sans', 'Trebuchet MS', sans-serif",
    mono: "'DM Mono', 'Courier New', monospace",
  };
  const inputSt = {
    width: '100%', padding: '8px 11px',
    background: C.white, border: '1.5px solid ' + C.sand,
    borderRadius: 6, fontSize: 13, color: C.ink,
    fontFamily: FONTS.sans, outline: 'none', boxSizing: 'border-box',
  };

  const [inventory, setInventory]             = useState([]);
  const [events, setEvents]                   = useState([]);
  const [assignments, setAssignments]         = useState({});
  const [customOrders, setCustomOrders]       = useState({});
  const [eventNotes, setEventNotes]           = useState({});
  const [selectedEventId, setSelectedEventId] = useState('');
  const [modal, setModal]                     = useState(null);
  const [editTarget, setEditTarget]           = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [saving, setSaving]                   = useState(false);
  const [invSearch, setInvSearch]             = useState('');
  const [catFilter, setCatFilter]             = useState('All');
  const [printMode, setPrintMode]             = useState(false);
  const [sortMode, setSortMode]               = useState('category');

  const dragItem      = useRef(null);
  const dragOverItem  = useRef(null);
  const noteTimer     = useRef(null);
  const lastSelectedEvent = useRef('');

  // Item form fields
  const [itemName, setItemName]         = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemQty, setItemQty]           = useState('');
  const [itemNotes, setItemNotes]       = useState('');
  const [itemTags, setItemTags]         = useState('');

  // Event form fields
  const [eventName, setEventName]           = useState('');
  const [eventDate, setEventDate]           = useState('');
  const [eventVenue, setEventVenue]         = useState('');
  const [eventClient, setEventClient]       = useState('');
  const [eventHoles, setEventHoles]         = useState('');
  const [eventFormNotes, setEventFormNotes] = useState('');

  // ─────────────────────────────────────────
  // CORE: Load all data from Supabase
  // Uses teamId so all team members see same data
  // Called after every mutation to keep state fresh
  // ─────────────────────────────────────────
  const loadAll = useCallback(async (selectEventId) => {
    try {
      const [invRes, evRes, asgnRes, coRes, enRes] = await Promise.all([
        supabase.from('inventory').select('*').eq('team_id', teamId).order('name'),
        supabase.from('events').select('*').eq('team_id', teamId).order('created_at'),
        supabase.from('assignments').select('*').eq('team_id', teamId),
        supabase.from('custom_orders').select('*').eq('team_id', teamId),
        supabase.from('event_notes').select('*').eq('team_id', teamId),
      ]);

      if (invRes.data)  setInventory(invRes.data);
      if (evRes.data)   setEvents(evRes.data);

      if (asgnRes.data) {
        const asgn = {};
        for (const row of asgnRes.data) {
          if (!asgn[row.event_id]) asgn[row.event_id] = new Set();
          asgn[row.event_id].add(row.item_id);
        }
        setAssignments(asgn);
      }

      if (coRes.data) {
        const co = {};
        for (const row of coRes.data) co[row.event_id] = row.item_ids || [];
        setCustomOrders(co);
      }

      if (enRes.data) {
        const en = {};
        for (const row of enRes.data) en[row.event_id] = row.note || '';
        setEventNotes(en);
      }

      if (selectEventId !== undefined) {
        setSelectedEventId(selectEventId);
        lastSelectedEvent.current = selectEventId;
      }
    } catch (err) {
      console.error('loadAll error:', err);
    } finally {
      setLoading(false);
      setSaving(false);
    }
  }, [teamId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─────────────────────────────────────────
  // MODALS
  // ─────────────────────────────────────────
  function openAddItem() {
    setEditTarget(null);
    setItemName(''); setItemCategory(''); setItemQty(''); setItemNotes(''); setItemTags('');
    setModal('item');
  }
  function openEditItem(item) {
    setEditTarget(item);
    setItemName(item.name);
    setItemCategory(item.category || '');
    setItemQty(item.qty || '');
    setItemNotes(item.notes || '');
    setItemTags(item.tags || '');
    setModal('item');
  }
  function openAddEvent() {
    setEditTarget(null);
    setEventName(''); setEventDate(''); setEventVenue('');
    setEventClient(''); setEventHoles(''); setEventFormNotes('');
    setModal('event');
  }
  function openEditEvent(ev) {
    setEditTarget(ev);
    setEventName(ev.name);
    setEventDate(ev.date || '');
    setEventVenue(ev.venue || '');
    setEventClient(ev.client || '');
    setEventHoles(ev.holes || '');
    setEventFormNotes(ev.notes || '');
    setModal('event');
  }

  // ─────────────────────────────────────────
  // INVENTORY CRUD
  // Key fix: no .select().single() after insert/update
  // Just fire the mutation and reload all data
  // ─────────────────────────────────────────
  async function saveItem() {
    if (!itemName.trim()) return;
    setSaving(true);
    setModal(null);

    const data = {
      team_id: teamId,
      user_id: user.id,
      name: itemName.trim(),
      category: itemCategory.trim() || 'General',
      qty: itemQty.trim(),
      notes: itemNotes.trim(),
      tags: itemTags.trim(),
    };

    try {
      if (editTarget) {
        await supabase.from('inventory').update(data).eq('id', editTarget.id);
      } else {
        await supabase.from('inventory').insert(data);
      }
    } catch (err) {
      console.error('saveItem error:', err);
    }

    await loadAll(selectedEventId);
  }

  async function deleteItem() {
    setSaving(true);
    setModal(null);
    await supabase.from('inventory').delete().eq('id', editTarget.id);
    await loadAll(selectedEventId);
  }

  // ─────────────────────────────────────────
  // EVENTS CRUD
  // Same pattern: fire mutation, reload all
  // ─────────────────────────────────────────
  async function saveEvent() {
    if (!eventName.trim()) return;
    setSaving(true);
    setModal(null);

    const data = {
      team_id: teamId,
      user_id: user.id,
      name: eventName.trim(),
      date: eventDate,
      venue: eventVenue.trim(),
      client: eventClient.trim(),
      holes: eventHoles.trim(),
      notes: eventFormNotes.trim(),
      completed: editTarget ? editTarget.completed : false,
    };

    try {
      if (editTarget) {
        await supabase.from('events').update(data).eq('id', editTarget.id);
        await loadAll(selectedEventId);
      } else {
        // For new events, insert and then find the new event to select it
        await supabase.from('events').insert(data);
        // Reload and select the newest event
        const { data: evList } = await supabase
          .from('events')
          .select('*')
          .eq('team_id', teamId)
          .order('created_at', { ascending: false })
          .limit(1);
        const newId = evList && evList.length > 0 ? evList[0].id : selectedEventId;
        await loadAll(newId);
      }
    } catch (err) {
      console.error('saveEvent error:', err);
      await loadAll(selectedEventId);
    }
  }

  async function deleteEvent() {
    setSaving(true);
    setModal(null);
    await supabase.from('events').delete().eq('id', editTarget.id);
    if (selectedEventId === editTarget.id) {
      await loadAll('');
    } else {
      await loadAll(selectedEventId);
    }
  }

  async function duplicateEvent() {
    setSaving(true);
    setModal(null);
    const src = editTarget;

    try {
      // Insert duplicate event
      await supabase.from('events').insert({
        team_id: teamId, user_id: user.id,
        name: src.name + ' (copy)',
        date: src.date, venue: src.venue, client: src.client,
        holes: src.holes, notes: src.notes, completed: false,
      });

      // Get the new event id
      const { data: evList } = await supabase
        .from('events').select('*').eq('team_id', teamId)
        .order('created_at', { ascending: false }).limit(1);

      if (evList && evList.length > 0) {
        const newId = evList[0].id;
        const srcSet = assignments[src.id] || new Set();

        // Copy assignments
        if (srcSet.size > 0) {
          const rows = [...srcSet].map(item_id => ({
            team_id: teamId, user_id: user.id, event_id: newId, item_id,
          }));
          await supabase.from('assignments').insert(rows);
        }

        // Copy custom order
        if (customOrders[src.id] && customOrders[src.id].length > 0) {
          await supabase.from('custom_orders').insert({
            team_id: teamId, user_id: user.id,
            event_id: newId, item_ids: customOrders[src.id],
          });
        }

        // Copy event notes
        if (eventNotes[src.id]) {
          await supabase.from('event_notes').insert({
            team_id: teamId, user_id: user.id,
            event_id: newId, note: eventNotes[src.id],
          });
        }

        await loadAll(newId);
      } else {
        await loadAll(selectedEventId);
      }
    } catch (err) {
      console.error('duplicateEvent error:', err);
      await loadAll(selectedEventId);
    }
  }

  async function toggleComplete(ev) {
    await supabase.from('events').update({ completed: !ev.completed }).eq('id', ev.id);
    await loadAll(selectedEventId);
  }

  // ─────────────────────────────────────────
  // ASSIGNMENTS
  // ─────────────────────────────────────────
  async function toggleAssign(itemId) {
    if (!selectedEventId) return;
    const current = new Set(assignments[selectedEventId] || []);

    if (current.has(itemId)) {
      // Remove from assignments
      await supabase.from('assignments')
        .delete()
        .eq('event_id', selectedEventId)
        .eq('item_id', itemId);

      // Remove from custom order
      const newOrder = (customOrders[selectedEventId] || []).filter(id => id !== itemId);
      await supabase.from('custom_orders').upsert({
        team_id: teamId, user_id: user.id,
        event_id: selectedEventId, item_ids: newOrder,
      }, { onConflict: 'event_id' });
    } else {
      // Add to assignments
      await supabase.from('assignments').insert({
        team_id: teamId, user_id: user.id,
        event_id: selectedEventId, item_id: itemId,
      });

      // Add to end of custom order
      const newOrder = [...(customOrders[selectedEventId] || []), itemId];
      await supabase.from('custom_orders').upsert({
        team_id: teamId, user_id: user.id,
        event_id: selectedEventId, item_ids: newOrder,
      }, { onConflict: 'event_id' });
    }

    // Optimistic local update for responsiveness
    const next = new Set(current);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    setAssignments(prev => ({ ...prev, [selectedEventId]: next }));
    const updatedOrder = next.has(itemId)
      ? [...(customOrders[selectedEventId] || []), itemId]
      : (customOrders[selectedEventId] || []).filter(id => id !== itemId);
    setCustomOrders(prev => ({ ...prev, [selectedEventId]: updatedOrder }));
  }

  async function handleTagPill(tag) {
    if (!selectedEventId) return;
    const taggedIds = inventory.filter(i => parseTags(i.tags).includes(tag)).map(i => i.id);
    const current   = new Set(assignments[selectedEventId] || []);
    const allAssigned = taggedIds.length > 0 && taggedIds.every(id => current.has(id));

    if (allAssigned) {
      await supabase.from('assignments')
        .delete()
        .eq('event_id', selectedEventId)
        .in('item_id', taggedIds);

      const newOrder = (customOrders[selectedEventId] || []).filter(id => !taggedIds.includes(id));
      await supabase.from('custom_orders').upsert({
        team_id: teamId, user_id: user.id,
        event_id: selectedEventId, item_ids: newOrder,
      }, { onConflict: 'event_id' });
    } else {
      const newIds = taggedIds.filter(id => !current.has(id));
      if (newIds.length > 0) {
        const rows = newIds.map(item_id => ({
          team_id: teamId, user_id: user.id,
          event_id: selectedEventId, item_id,
        }));
        await supabase.from('assignments').insert(rows);

        const newOrder = [...(customOrders[selectedEventId] || []), ...newIds];
        await supabase.from('custom_orders').upsert({
          team_id: teamId, user_id: user.id,
          event_id: selectedEventId, item_ids: newOrder,
        }, { onConflict: 'event_id' });
      }
    }

    await loadAll(selectedEventId);
  }

  // Debounced note save
  function handleNoteChange(val) {
    setEventNotes(prev => ({ ...prev, [selectedEventId]: val }));
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      await supabase.from('event_notes').upsert({
        team_id: teamId, user_id: user.id,
        event_id: selectedEventId, note: val,
      }, { onConflict: 'event_id' });
    }, 800);
  }

  // ─────────────────────────────────────────
  // DRAG TO REORDER
  // ─────────────────────────────────────────
  function handleDragStart(idx) { dragItem.current = idx; }
  function handleDragEnter(idx) { dragOverItem.current = idx; }

  async function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const currentOrder = customOrders[selectedEventId] || customSortedItems.map(i => i.id);
    const order = [...currentOrder];
    const dragged = order.splice(dragItem.current, 1)[0];
    order.splice(dragOverItem.current, 0, dragged);

    setCustomOrders(prev => ({ ...prev, [selectedEventId]: order }));

    await supabase.from('custom_orders').upsert({
      team_id: teamId, user_id: user.id,
      event_id: selectedEventId, item_ids: order,
    }, { onConflict: 'event_id' });

    dragItem.current = null;
    dragOverItem.current = null;
  }

  // ─────────────────────────────────────────
  // DERIVED STATE
  // ─────────────────────────────────────────
  const assignedSet       = assignments[selectedEventId] || new Set();
  const allCategories     = Array.from(new Set(inventory.map(i => i.category))).sort();
  const allTags           = Array.from(new Set(inventory.flatMap(i => parseTags(i.tags)))).sort();

  const filteredInventory = inventory.filter(i =>
    i.name.toLowerCase().includes(invSearch.toLowerCase()) &&
    (catFilter === 'All' || i.category === catFilter)
  );

  const assignedItems       = inventory.filter(i => assignedSet.has(i.id));
  const azSortedItems       = [...assignedItems].sort((a, b) => a.name.localeCompare(b.name));
  const categorySortedItems = [...assignedItems].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const customOrder         = customOrders[selectedEventId] || [];
  const customSortedItems   = [
    ...customOrder.map(id => assignedItems.find(i => i.id === id)).filter(Boolean),
    ...assignedItems.filter(i => !customOrder.includes(i.id)),
  ];
  const displayedItems     = sortMode === 'az' ? azSortedItems : sortMode === 'category' ? categorySortedItems : customSortedItems;
  const assignedCategories = Array.from(new Set(categorySortedItems.map(i => i.category))).sort();
  const selectedEvent      = events.find(e => e.id === selectedEventId);
  const today              = new Date().toISOString().slice(0, 10);
  const upcomingEvents     = events.filter(e => !e.completed && (!e.date || e.date >= today));
  const pastEvents         = events.filter(e => !e.completed && e.date && e.date < today);
  const completedEvents    = events.filter(e => e.completed);
  const currentNote        = eventNotes[selectedEventId] || '';

  // ─────────────────────────────────────────
  // LOADING SCREEN
  // ─────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.green, fontFamily: FONTS.display, color: C.cream, fontSize: 18, gap: 12 }}>
        <span style={{ fontSize: 28 }}>⛳</span> Loading…
      </div>
    );
  }

  // ─────────────────────────────────────────
  // PRINT VIEW
  // ─────────────────────────────────────────
  if (printMode && selectedEvent) {
    const printItems = displayedItems;
    const printCategories = Array.from(new Set(printItems.map(i => i.category)));
    const noteText = eventNotes[selectedEvent.id] || '';

    return (
      <div style={{ background: C.white, minHeight: '100vh', fontFamily: FONTS.sans, color: C.ink }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Instrument+Sans:wght@400;500;600&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          @media print { .no-print { display: none !important; } }
        `}</style>

        <div className="no-print" style={{ background: C.green, color: C.cream, padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontSize: 13, color: '#8abda0' }}>Print preview — <strong style={{ color: C.cream }}>{selectedEvent.name}</strong></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setPrintMode(false)} style={{ background: 'transparent', color: '#8abda0', border: '1.5px solid #3a7a56', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
            <button onClick={() => window.print()} style={{ background: C.greenLight, color: C.white, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer' }}>🖨 Print / Save as PDF</button>
          </div>
        </div>

        <div style={{ padding: '40px 48px', maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16, borderBottom: '3px solid ' + C.green, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.greenLight, marginBottom: 6 }}>⛳ PGX Event Inventory Manager</div>
              <div style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 700, color: C.green, marginBottom: 6 }}>{selectedEvent.name}</div>
              <div style={{ display: 'flex', gap: 20, fontSize: 12, color: C.inkLight, flexWrap: 'wrap' }}>
                {selectedEvent.date   && <span>📅 {formatDate(selectedEvent.date)}</span>}
                {selectedEvent.venue  && <span>📍 {selectedEvent.venue}</span>}
                {selectedEvent.holes  && <span>⛳ {selectedEvent.holes} hole{selectedEvent.holes !== '1' ? 's' : ''}</span>}
                {selectedEvent.client && <span>👤 {selectedEvent.client}</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: C.inkFaint }}>
              <div>Printed: {new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 20, fontWeight: 700, color: C.green, marginTop: 4 }}>{printItems.length} items</div>
            </div>
          </div>

          {sortMode === 'category' ? (
            printCategories.map(cat => {
              const catItems = printItems.filter(i => i.category === cat);
              return (
                <div key={cat} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.green, fontWeight: 600, paddingBottom: 5, borderBottom: '1px solid ' + C.greenBorder, marginBottom: 8 }}>{cat}</div>
                  {catItems.map((item, idx) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: idx < catItems.length - 1 ? '1px solid #f0ebe0' : 'none' }}>
                      <div style={{ width: 16, height: 16, border: '1.5px solid ' + C.greenLight, borderRadius: 3, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 14 }}>{item.name}</div>
                      {item.qty && <div style={{ fontSize: 12, color: C.inkLight, background: C.paper, padding: '1px 8px', borderRadius: 4, fontFamily: FONTS.mono }}>×{item.qty}</div>}
                      {item.notes && <div style={{ fontSize: 12, color: C.inkFaint, fontStyle: 'italic' }}>{item.notes}</div>}
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <div style={{ marginBottom: 28 }}>
              {printItems.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: idx < printItems.length - 1 ? '1px solid #f0ebe0' : 'none' }}>
                  <div style={{ width: 16, height: 16, border: '1.5px solid ' + C.greenLight, borderRadius: 3, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 14 }}>{item.name}</div>
                  {item.qty && <div style={{ fontSize: 12, color: C.inkLight, background: C.paper, padding: '1px 8px', borderRadius: 4, fontFamily: FONTS.mono }}>×{item.qty}</div>}
                  {item.notes && <div style={{ fontSize: 12, color: C.inkFaint, fontStyle: 'italic' }}>{item.notes}</div>}
                  <div style={{ fontSize: 11, color: C.inkFaint, background: C.greenPale, padding: '1px 7px', borderRadius: 10 }}>{item.category}</div>
                </div>
              ))}
            </div>
          )}

          {noteText ? (
            <div style={{ marginTop: 24, padding: '14px 16px', background: C.paper, borderRadius: 8, border: '1px solid ' + C.sand, fontSize: 13, color: C.inkLight }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.inkFaint, fontWeight: 600, marginBottom: 6 }}>Notes</div>
              {noteText}
            </div>
          ) : (
            <div style={{ marginTop: 24, fontSize: 12, color: C.inkFaint, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Notes:</span>
              <div style={{ flex: 1, borderBottom: '1px solid ' + C.sand }} />
            </div>
          )}

          <div style={{ marginTop: 32, paddingTop: 14, borderTop: '1px solid ' + C.sand, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkFaint }}>
            <span>PGX Event Inventory Manager</span>
            <span>{selectedEvent.name}{selectedEvent.date ? ' · ' + formatDate(selectedEvent.date) : ''}</span>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // STYLE HELPERS
  // ─────────────────────────────────────────
  const editBtnSt = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: C.inkFaint, fontSize: 13, padding: '2px 6px',
    fontFamily: FONTS.sans, flexShrink: 0,
  };
  const sortBtnSt = (active) => ({
    background: active ? C.green : C.white,
    color: active ? C.white : C.inkLight,
    border: '1.5px solid ' + (active ? C.green : C.sand),
    borderRadius: 5, padding: '5px 11px', fontSize: 11,
    fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer',
  });

  // ─────────────────────────────────────────
  // MAIN APP
  // ─────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.paper, fontFamily: FONTS.sans, color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Instrument+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #e4ddd0; border-radius: 3px; }
      `}</style>

      {/* SAVING INDICATOR */}
      {saving && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: C.greenLight, zIndex: 9999 }} />
      )}

      {/* HEADER */}
      <header style={{ background: C.green, color: C.cream, height: 60, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26 }}>⛳</span>
          <div>
            <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 700, letterSpacing: .5 }}>PGX</div>
            <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#8abda0', marginTop: 1 }}>Event Inventory Manager</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#8abda0' }}>{user.email}</span>
          <button onClick={openAddItem} style={{ background: 'transparent', color: '#8abda0', border: '1.5px solid #3a7a56', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer' }}>+ Add Item</button>
          <button onClick={openAddEvent} style={{ background: C.greenLight, color: C.white, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer' }}>+ New Event</button>
          <button onClick={onSignOut} style={{ background: 'transparent', color: '#8abda0', border: 'none', fontSize: 12, fontFamily: FONTS.sans, cursor: 'pointer', padding: '7px 8px' }}>Sign out</button>
        </div>
      </header>

      {/* TWO PANELS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 'calc(100vh - 60px)' }}>

        {/* ── LEFT: Master Inventory ── */}
        <div style={{ borderRight: '1px solid ' + C.sand, padding: '28px', background: C.white, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#9a9a88', fontWeight: 600 }}>Master Inventory</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: C.inkFaint }}>{inventory.length} item{inventory.length !== 1 ? 's' : ''}</div>
          </div>

          {/* Tag pills */}
          {allTags.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.inkFaint, fontWeight: 600, marginBottom: 7 }}>
                Quick-assign by tag {!selectedEventId && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— select an event first</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allTags.map(tag => {
                  const taggedIds    = inventory.filter(i => parseTags(i.tags).includes(tag)).map(i => i.id);
                  const allAssigned  = selectedEventId && taggedIds.length > 0 && taggedIds.every(id => assignedSet.has(id));
                  const someAssigned = selectedEventId && taggedIds.some(id => assignedSet.has(id));
                  return (
                    <button key={tag} onClick={() => handleTagPill(tag)} disabled={!selectedEventId}
                      style={{ background: allAssigned ? C.tealLight : C.tealPale, color: allAssigned ? C.white : C.teal, border: '1.5px solid ' + (allAssigned ? C.tealLight : C.tealBorder), borderRadius: 20, padding: '4px 12px', fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600, cursor: selectedEventId ? 'pointer' : 'not-allowed', opacity: selectedEventId ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {allAssigned ? '✓' : someAssigned ? '◑' : '+'} {tag} <span style={{ fontSize: 10, opacity: 0.7 }}>({taggedIds.length})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search + filter */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.inkFaint }}>🔍</span>
            <input value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Search items…" style={{ ...inputSt, paddingLeft: 30 }} />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ ...inputSt, marginBottom: 12, cursor: 'pointer' }}>
            <option value="All">All Categories</option>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {!selectedEventId && inventory.length > 0 && (
            <div style={{ background: C.greenPale, border: '1px solid ' + C.greenBorder, borderRadius: 6, padding: '9px 12px', marginBottom: 12, fontSize: 12, color: C.green }}>
              👉 Select an event on the right to start assigning items
            </div>
          )}

          {(invSearch || catFilter !== 'All') && (
            <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 10, fontFamily: FONTS.mono }}>
              Showing {filteredInventory.length} of {inventory.length} items
            </div>
          )}

          {inventory.length === 0 ? (
            <div style={{ color: C.inkFaint, fontSize: 13 }}>Your full equipment list will appear here.</div>
          ) : filteredInventory.length === 0 ? (
            <div style={{ color: C.inkFaint, fontSize: 13 }}>No items match your search.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredInventory.map(item => {
                const checked = assignedSet.has(item.id);
                const tags    = parseTags(item.tags);
                return (
                  <div key={item.id} style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid ' + (checked ? C.greenBorder : C.sand), background: checked ? C.greenPale : C.white, display: 'flex', alignItems: 'center', gap: 12, transition: 'all .12s' }}>
                    <div onClick={() => toggleAssign(item.id)}
                      style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: '2px solid ' + (checked ? C.greenLight : C.sand), background: checked ? C.greenLight : C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: selectedEventId ? 'pointer' : 'default', transition: 'all .12s' }}>
                      {checked && <span style={{ color: C.white, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div onClick={() => toggleAssign(item.id)} style={{ flex: 1, cursor: selectedEventId ? 'pointer' : 'default' }}>
                      <div style={{ fontSize: 14, color: C.ink, fontWeight: checked ? 600 : 500 }}>{item.name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 3, fontSize: 11, alignItems: 'center' }}>
                        <span style={{ background: checked ? C.white : C.greenPale, color: C.green, padding: '1px 7px', borderRadius: 10, fontWeight: 600, fontSize: 10 }}>{item.category}</span>
                        {item.qty && <span style={{ fontFamily: FONTS.mono, color: C.inkFaint }}>×{item.qty}</span>}
                        {tags.map(t => <span key={t} style={{ background: C.tealPale, color: C.teal, padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>{t}</span>)}
                        {item.notes && <span style={{ color: C.inkFaint, fontStyle: 'italic' }}>{item.notes}</span>}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); openEditItem(item); }} style={editBtnSt}>✎</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Event ── */}
        <div style={{ padding: '28px', background: C.paper, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#9a9a88', fontWeight: 600, marginBottom: 12 }}>Event</div>
          <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} style={{ ...inputSt, marginBottom: 20, cursor: 'pointer' }}>
            <option value="">— Choose an event —</option>
            {upcomingEvents.length > 0 && (
              <optgroup label="Upcoming">
                {upcomingEvents.map(e => <option key={e.id} value={e.id}>{e.name}{e.date ? '  ·  ' + formatDate(e.date) : ''}</option>)}
              </optgroup>
            )}
            {pastEvents.length > 0 && (
              <optgroup label="Past">
                {pastEvents.map(e => <option key={e.id} value={e.id}>{e.name}{e.date ? '  ·  ' + formatDate(e.date) : ''}</option>)}
              </optgroup>
            )}
            {completedEvents.length > 0 && (
              <optgroup label="✓ Completed">
                {completedEvents.map(e => <option key={e.id} value={e.id}>✓ {e.name}{e.date ? '  ·  ' + formatDate(e.date) : ''}</option>)}
              </optgroup>
            )}
          </select>

          {!selectedEvent ? (
            <div style={{ color: C.inkFaint, fontSize: 13 }}>Select or create an event to manage its equipment.</div>
          ) : (
            <>
              {/* Event card */}
              <div style={{ position: 'relative', background: selectedEvent.completed ? '#2a3a2e' : C.green, color: C.cream, borderRadius: 10, padding: '18px 20px', marginBottom: 24, boxShadow: '0 4px 16px rgba(26,74,46,.18)', opacity: selectedEvent.completed ? 0.85 : 1 }}>
                <div style={{ position: 'absolute', top: 12, right: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {selectedEvent.completed && (
                    <span style={{ background: C.greenLight, color: C.white, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10, letterSpacing: 1 }}>✓ COMPLETE</span>
                  )}
                  <button onClick={() => toggleComplete(selectedEvent)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 5, color: C.cream, cursor: 'pointer', fontSize: 11, padding: '4px 10px', fontFamily: FONTS.sans }}>
                    {selectedEvent.completed ? '↩ Reopen' : '✓ Mark Complete'}
                  </button>
                  <button onClick={() => openEditEvent(selectedEvent)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 5, color: C.cream, cursor: 'pointer', fontSize: 12, padding: '4px 10px', fontFamily: FONTS.sans }}>✎ Edit</button>
                </div>
                <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{selectedEvent.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: '#8abda0' }}>
                  {selectedEvent.date   && <span>📅 {formatDate(selectedEvent.date)}</span>}
                  {selectedEvent.venue  && <span>📍 {selectedEvent.venue}</span>}
                  {selectedEvent.holes  && <span>⛳ {selectedEvent.holes} hole{selectedEvent.holes !== '1' ? 's' : ''}</span>}
                  {selectedEvent.client && <span>👤 {selectedEvent.client}</span>}
                </div>
              </div>

              {/* Equipment header + print */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#9a9a88', fontWeight: 600 }}>Equipment List</div>
                {assignedItems.length > 0 && (
                  <button onClick={() => setPrintMode(true)} style={{ background: C.green, color: C.white, border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer' }}>🖨 Print / Save PDF</button>
                )}
              </div>

              {/* Sort buttons */}
              {assignedItems.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  <button onClick={() => setSortMode('category')} style={sortBtnSt(sortMode === 'category')}>By Category</button>
                  <button onClick={() => setSortMode('az')} style={sortBtnSt(sortMode === 'az')}>A – Z</button>
                  <button onClick={() => setSortMode('custom')} style={sortBtnSt(sortMode === 'custom')}>✥ Custom</button>
                  {sortMode === 'custom' && <span style={{ fontSize: 11, color: C.inkFaint, alignSelf: 'center', marginLeft: 4 }}>drag to reorder</span>}
                </div>
              )}

              {/* Equipment list */}
              {assignedItems.length === 0 ? (
                <div style={{ border: '1.5px dashed ' + C.sand, borderRadius: 8, padding: '24px', textAlign: 'center', color: C.inkFaint, fontSize: 13, marginBottom: 20 }}>
                  No items assigned yet.<br />
                  <span style={{ color: C.green, fontSize: 12 }}>Check items or use tag pills in the inventory panel.</span>
                </div>
              ) : sortMode === 'category' ? (
                assignedCategories.map(cat => {
                  const catItems = categorySortedItems.filter(i => i.category === cat);
                  return (
                    <div key={cat} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.green, fontWeight: 600, marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid ' + C.greenBorder }}>{cat}</div>
                      <div style={{ background: C.white, borderRadius: 8, border: '1px solid ' + C.sand, overflow: 'hidden' }}>
                        {catItems.map((item, idx) => (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: idx < catItems.length - 1 ? '1px solid ' + C.sand : 'none' }}>
                            <div style={{ width: 16, height: 16, border: '1.5px solid ' + C.greenLight, borderRadius: 3, flexShrink: 0, background: C.white }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{item.name}</span>
                              {item.qty && <span style={{ marginLeft: 10, fontFamily: FONTS.mono, fontSize: 12, color: C.inkLight, background: C.paper, padding: '1px 6px', borderRadius: 4 }}>×{item.qty}</span>}
                              {item.notes && <span style={{ marginLeft: 8, fontSize: 12, color: C.inkFaint, fontStyle: 'italic' }}>{item.notes}</span>}
                            </div>
                            <button onClick={() => toggleAssign(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkFaint, fontSize: 14, padding: '2px 4px' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ background: C.white, borderRadius: 8, border: '1px solid ' + C.sand, overflow: 'hidden', marginBottom: 16 }}>
                  {displayedItems.map((item, idx) => (
                    <div key={item.id}
                      draggable={sortMode === 'custom'}
                      onDragStart={() => handleDragStart(idx)}
                      onDragEnter={() => handleDragEnter(idx)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => e.preventDefault()}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: idx < displayedItems.length - 1 ? '1px solid ' + C.sand : 'none', background: C.white, cursor: sortMode === 'custom' ? 'grab' : 'default' }}>
                      {sortMode === 'custom'
                        ? <span style={{ color: C.sand, fontSize: 16, flexShrink: 0, userSelect: 'none' }}>⠿</span>
                        : <div style={{ width: 16, height: 16, border: '1.5px solid ' + C.greenLight, borderRadius: 3, flexShrink: 0, background: C.white }} />
                      }
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{item.name}</span>
                        {item.qty && <span style={{ marginLeft: 10, fontFamily: FONTS.mono, fontSize: 12, color: C.inkLight, background: C.paper, padding: '1px 6px', borderRadius: 4 }}>×{item.qty}</span>}
                        {item.notes && <span style={{ marginLeft: 8, fontSize: 12, color: C.inkFaint, fontStyle: 'italic' }}>{item.notes}</span>}
                      </div>
                      <span style={{ fontSize: 10, color: C.inkFaint, background: C.greenPale, padding: '1px 7px', borderRadius: 10 }}>{item.category}</span>
                      <button onClick={() => toggleAssign(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkFaint, fontSize: 14, padding: '2px 4px' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Event notes */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#9a9a88', fontWeight: 600, marginBottom: 8 }}>Event Notes</div>
                <textarea
                  value={currentNote}
                  onChange={e => handleNoteChange(e.target.value)}
                  placeholder="Load-out instructions, special requirements, contact details…"
                  rows={4}
                  style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ITEM MODAL ── */}
      {modal === 'item' && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,16,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 12, padding: '32px 28px', width: 440, boxShadow: '0 32px 80px rgba(0,0,0,.25)', border: '1px solid ' + C.sand }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 700, color: C.green, marginBottom: 24 }}>
              {editTarget ? '✎ Edit Item' : '📦 New Inventory Item'}
            </div>
            {[
              ['Item Name *', itemName, setItemName, 'e.g. Red Putter, Windmill obstacle…'],
              ['Category',    itemCategory, setItemCategory, 'e.g. Obstacles, Clubs, Signage…'],
              ['Tags',        itemTags, setItemTags, 'e.g. putters, stagette-kit (comma separated)'],
              ['Quantity',    itemQty, setItemQty, 'e.g. 12'],
              ['Notes',       itemNotes, setItemNotes, 'Condition, colour, storage location…'],
            ].map(([label, val, setter, ph]) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.inkFaint, fontWeight: 600, marginBottom: 5 }}>{label}</div>
                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} style={inputSt} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div>
                {editTarget && (
                  <button onClick={deleteItem} style={{ background: C.redPale, color: C.red, border: '1.5px solid #e8c0c0', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer' }}>Delete Item</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModal(null)} style={{ background: 'none', border: '1.5px solid ' + C.sand, borderRadius: 6, padding: '8px 18px', fontSize: 12, fontFamily: FONTS.sans, color: C.inkFaint, cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveItem} style={{ background: C.green, color: C.white, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EVENT MODAL ── */}
      {modal === 'event' && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,16,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 12, padding: '32px 28px', width: 420, boxShadow: '0 32px 80px rgba(0,0,0,.25)', border: '1px solid ' + C.sand }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 700, color: C.green, marginBottom: 24 }}>
              {editTarget ? '✎ Edit Event' : '⛳ New Event'}
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.inkFaint, fontWeight: 600, marginBottom: 5 }}>Event Name *</div>
              <input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Smith Wedding, Rogers Centre Takeover…" style={inputSt} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.inkFaint, fontWeight: 600, marginBottom: 5 }}>Date</div>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputSt} />
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.inkFaint, fontWeight: 600, marginBottom: 5 }}>Holes</div>
                <input value={eventHoles} onChange={e => setEventHoles(e.target.value)} placeholder="e.g. 9" style={inputSt} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.inkFaint, fontWeight: 600, marginBottom: 5 }}>Venue / Location</div>
              <input value={eventVenue} onChange={e => setEventVenue(e.target.value)} placeholder="e.g. Ballroom B, Rogers Centre…" style={inputSt} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.inkFaint, fontWeight: 600, marginBottom: 5 }}>Client / Contact</div>
              <input value={eventClient} onChange={e => setEventClient(e.target.value)} placeholder="Optional" style={inputSt} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.inkFaint, fontWeight: 600, marginBottom: 5 }}>Notes</div>
              <input value={eventFormNotes} onChange={e => setEventFormNotes(e.target.value)} placeholder="Optional" style={inputSt} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {editTarget && (
                  <button onClick={deleteEvent} style={{ background: C.redPale, color: C.red, border: '1.5px solid #e8c0c0', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                )}
                {editTarget && (
                  <button onClick={duplicateEvent} style={{ background: C.greenPale, color: C.green, border: '1.5px solid ' + C.greenBorder, borderRadius: 6, padding: '8px 16px', fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer' }}>⧉ Duplicate</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModal(null)} style={{ background: 'none', border: '1.5px solid ' + C.sand, borderRadius: 6, padding: '8px 18px', fontSize: 12, fontFamily: FONTS.sans, color: C.inkFaint, cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveEvent} style={{ background: C.green, color: C.white, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
