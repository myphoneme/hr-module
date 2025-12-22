import { StyleSheet } from '@react-pdf/renderer';

// Centralized styles for both PDF templates
// PDF FORMATTING RULES:
// - 1 inch margins (72pt) on all sides
// - 1.3 line spacing
// - Header and footer on same page with content
// - No extra blank space
export const styles = StyleSheet.create({
  // Page layout - 1 inch = 72pt margins, room for fixed footer
  page: {
    paddingTop: 50,        // ~0.7 inch from top for header
    paddingBottom: 70,     // Room for fixed footer
    paddingLeft: 72,       // 1 inch left margin
    paddingRight: 72,      // 1 inch right margin
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.3,
    color: '#111827',
  },

  // Typography
  heading1: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#E55300', // Orange color matching Phoneme branding
  },

  heading2: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 8,
    color: '#E55300', // Orange color matching Phoneme branding
  },

  heading3: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    marginBottom: 4,
    color: '#E55300', // Orange color matching Phoneme branding
  },

  text: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    lineHeight: 1.3,
    marginBottom: 4,
    color: '#000000',
  },

  textBold: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.3,
    marginBottom: 4,
    color: '#000000',
  },

  textSmall: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    lineHeight: 1.3,
    marginBottom: 4,
    color: '#000000',
  },

  // Header - compact, no extra space, content starts immediately below
  header: {
    flexDirection: 'column',
    marginBottom: 8,
  },

  logoContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },

  logo: {
    width: 100,
    height: 35,
  },

  dateText: {
    fontSize: 9,
    textAlign: 'right',
    color: '#000000',
  },

  // Footer - fixed at bottom of every page, full width (edge to edge)
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  footerOrangeLine: {
    height: 3,
    backgroundColor: '#FF6B35',
  },

  footerContent: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 15,
  },

  footerText: {
    fontSize: 8,
    textAlign: 'center',
    color: '#000000',
    lineHeight: 1.4,
  },

  footerLink: {
    fontSize: 7,
    textAlign: 'center',
    color: '#0000EE',
    textDecoration: 'underline',
    lineHeight: 1.4,
  },

  // Address and recipient - compact spacing
  recipientContainer: {
    marginBottom: 6,
  },

  addressText: {
    fontSize: 10,
    lineHeight: 1.3,
    marginBottom: 2,
  },

  // Subject - compact spacing
  subject: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },

  // Sections - minimal spacing for compact layout
  section: {
    marginBottom: 6,
  },

  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    marginTop: 8,
    color: '#000000',
  },

  subsection: {
    marginLeft: 12,
    marginBottom: 8,
  },

  // Lists - compact spacing
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
    marginLeft: 15,
  },

  listNumber: {
    width: 18,
    fontSize: 10,
  },

  listContent: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.3,
  },

  // Tables
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'solid',
    marginTop: 12,
    marginBottom: 12,
  },

  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },

  tableRowLast: {
    flexDirection: 'row',
  },

  tableHeader: {
    backgroundColor: '#F3F4F6',
  },

  tableCell: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    borderRightStyle: 'solid',
  },

  tableCellLast: {
    flex: 1,
    padding: 8,
    fontSize: 10,
  },

  tableCellHeader: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 1,
    borderRightColor: '#000000',
    borderRightStyle: 'solid',
  },

  tableCellHeaderLast: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },

  tableCellRight: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    textAlign: 'right',
    borderRightWidth: 1,
    borderRightColor: '#000000',
    borderRightStyle: 'solid',
  },

  tableCellRightLast: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    textAlign: 'right',
  },

  tableCellBold: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 1,
    borderRightColor: '#000000',
    borderRightStyle: 'solid',
  },

  tableCellBoldLast: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },

  tableTotal: {
    backgroundColor: '#F3F4F6',
  },

  // Signature section
  signatureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 20,
  },

  signatureBox: {
    width: '45%',
  },

  signatureImage: {
    width: 80,
    height: 40,
    marginBottom: 8,
  },

  signatureName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 0,
    color: '#000000',
  },

  signatureTitle: {
    fontSize: 10,
    color: '#000000',
    marginTop: 0,
  },

  acceptanceBox: {
    width: '45%',
    border: '1pt solid #D1D5DB',
    padding: 10,
    textAlign: 'center',
  },

  acceptanceTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },

  acceptanceText: {
    fontSize: 9,
    color: '#4B5563',
    marginBottom: 20,
  },

  // Annexure
  annexureTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 12,
    textDecoration: 'underline',
  },

  annexureSubtitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 16,
  },

  // KRA List Item
  kraListItem: {
    flexDirection: 'row',
    marginBottom: 6,
    marginLeft: 10,
  },

  kraListNumber: {
    width: 20,
    fontSize: 10,
  },

  kraListContent: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.4,
  },

  // Acknowledgement Section
  acknowledgementTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline',
    marginTop: 30,
    marginBottom: 15,
  },

  acknowledgementText: {
    fontSize: 10,
    marginBottom: 20,
    lineHeight: 1.4,
  },

  acknowledgementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  acknowledgementField: {
    width: '45%',
  },

  acknowledgementLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 15,
  },

  acknowledgementLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'dotted',
    marginTop: 10,
  },

  sealImage: {
    width: 80,
    height: 80,
    marginTop: 20,
    alignSelf: 'center',
  },

  // Numbered sections (for long form) - compact spacing
  numberedSection: {
    marginBottom: 8,
  },

  numberedHeading: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    marginTop: 8,
    color: '#E55300', // Orange color matching Phoneme branding
  },

  // Spacing utilities
  spacingSmall: {
    marginBottom: 6,
  },

  spacingMedium: {
    marginBottom: 12,
  },

  spacingLarge: {
    marginBottom: 20,
  },

  // Page break
  pageBreak: {
    pageBreakBefore: 'always',
  },
});
