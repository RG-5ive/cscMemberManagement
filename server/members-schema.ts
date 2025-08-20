import { pgTable, serial, text, boolean } from 'drizzle-orm/pg-core';

// Create a members table based on the CSV structure
export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  memberNumber: text('member_number'),
  category: text('category'),
  lastName: text('last_name'),
  firstName: text('first_name'),
  gender: text('gender'),
  knownAs: text('known_as'),
  province: text('province'),
  affiliation: text('affiliation'),
  occupation: text('occupation'),
  homePhone: text('home_phone'),
  cellPhone: text('cell_phone'),
  email: text('email'),
  website: text('website'),
  webReel: text('web_reel'),
  instagram: text('instagram'),
  isActive: boolean('is_active').default(true),
  hasPortalAccess: boolean('has_portal_access').default(false),
  importedAt: text('imported_at')
});