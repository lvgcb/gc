// Include events with a student team entry, even when solo entry is also allowed.
// A national delegation for an individually scored event does not count.
const groupEventIds = new Set([
  'C001', 'C002', 'C003', 'C004', 'C005', 'C006', 'C007',
  'C010', 'C011', 'C012', 'C013', 'C014', 'C021', 'C022', 'C023', 'C024', 'C026',
  'C032', 'C033', 'C034', 'C035', 'C036', 'C037', 'C038', 'C040', 'C042', 'C045',
  'C051', 'C052', 'C053', 'C061', 'C062', 'C063', 'C067', 'C068', 'C069', 'C070', 'C071', 'C074',
  'C093', 'C094', 'C095', 'C099', 'C100', 'C102', 'C103', 'C104', 'C106',
  'C108', 'C109', 'C110', 'C111', 'C114', 'C131', 'C132', 'C133', 'C136', 'C143',
  'C149', 'C150', 'C151', 'C152', 'C153', 'C154',
  'P017', 'P024',
])

export const isGroupEvent = item => item.groupEvent ?? groupEventIds.has(item.id)
