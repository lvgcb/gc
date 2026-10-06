// Student teamwork or a school group is required; solo-eligible events stay out.
const groupEventIds = new Set([
  'C010', 'C012', 'C013', 'C021', 'C022', 'C023', 'C024', 'C026',
  'C033', 'C034', 'C035', 'C036', 'C037', 'C038', 'C042', 'C045',
  'C051', 'C052', 'C061', 'C069', 'C070', 'C071', 'C074',
  'C093', 'C094', 'C095', 'C102', 'C103', 'C104', 'C106',
  'C108', 'C109', 'C110', 'C111', 'C131', 'C132', 'C143', 'C152',
  'P017', 'P024',
])

export const isGroupEvent = item => item.groupEvent ?? groupEventIds.has(item.id)
