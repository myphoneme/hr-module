import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { LOGO_URL } from './logo';
import type { CompanyLetterWithDetails } from '../../types';

interface CompanyLetterPDFProps {
  letter: CompanyLetterWithDetails;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.6,
    color: '#000000',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 10,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 32,
  },
  companyDetails: {
    fontSize: 7,
    textAlign: 'right',
    lineHeight: 1.3,
  },
  // Reference and date
  refSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    fontSize: 10,
  },
  // Content
  recipient: {
    marginBottom: 15,
    fontSize: 11,
  },
  subject: {
    marginBottom: 15,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  body: {
    textAlign: 'justify',
    lineHeight: 1.5,
    marginBottom: 10,
  },
  paragraph: {
    marginBottom: 6,
    fontSize: 11,
    lineHeight: 1.5,
  },
  closing: {
    marginTop: 0,
  },
  signature: {
    marginTop: 20,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  orangeLine: {
    height: 3,
    backgroundColor: '#FF6B35',
  },
  footerContent: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    fontSize: 8,
    textAlign: 'center',
    lineHeight: 1.4,
  },
});

export function CompanyLetterPDF({ letter }: CompanyLetterPDFProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Split body into paragraphs (by double newline for actual paragraphs)
  const paragraphs = letter.body
    .split(/\n\n+/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => p);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <Image src={LOGO_URL} style={styles.logo} />
          </View>
        </View>

        {/* Reference and Date */}
        <View style={styles.refSection}>
          <Text>
            {letter.letterNumber ? `Ref: ${letter.letterNumber}` : ''}
          </Text>
          <Text>Date: {formatDate(letter.letterDate)}</Text>
        </View>

        {/* Recipient */}
        <View style={styles.recipient}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>To,</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>{letter.recipientName}</Text>
          <Text>{letter.recipientAddress}</Text>
          {(letter.recipientCity || letter.recipientState || letter.recipientPincode) && (
            <Text>
              {[letter.recipientCity, letter.recipientState, letter.recipientPincode]
                .filter(Boolean)
                .join(', ')}
            </Text>
          )}
        </View>

        {/* Subject */}
        <View style={styles.subject}>
          <Text>
            <Text style={{ textDecoration: 'underline' }}>Subject: </Text>
            {letter.subject}
          </Text>
        </View>

        {/* Greeting */}
        <Text style={{ marginBottom: 8 }}>{letter.greeting},</Text>

        {/* Body */}
        <View style={styles.body}>
          {paragraphs.map((paragraph, index) => (
            <Text key={index} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>

        {/* Closing */}
        <View style={styles.closing}>
          <Text style={{ marginBottom: 0 }}>{letter.closing},</Text>
          <Text style={{ fontSize: 11, marginTop: 0 }}>For Phoneme Solutions Private Limited.</Text>

          {/* Signature Section */}
          <View style={{ marginTop: 0 }}>
            {letter.signatories && letter.signatories.length > 0 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                {letter.signatories.map((signatory) => {
                  // signatureImage and stampImage are now base64 data URLs
                  const hasSignatureImage = signatory.signatureImage && signatory.signatureImage.startsWith('data:');
                  const hasStampImage = signatory.stampImage && signatory.stampImage.startsWith('data:');

                  return (
                    <View key={signatory.id} style={{ width: letter.signatories.length > 1 ? '48%' : '100%', marginBottom: 10 }}>
                      {/* Signature Image */}
                      {hasSignatureImage && (
                        <Image
                          src={signatory.signatureImage}
                          style={{ width: 120, height: 60, marginTop: 5, marginBottom: 3, objectFit: 'contain' }}
                        />
                      )}
                      {!hasSignatureImage && (
                        <View style={{ marginTop: 20, marginBottom: 3 }}>
                          <Text>____________________</Text>
                        </View>
                      )}

                      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>{signatory.name}</Text>
                      <Text style={{ fontSize: 10 }}>{signatory.position}</Text>
                      {signatory.department && (
                        <Text style={{ fontSize: 10 }}>{signatory.department}</Text>
                      )}

                      {/* Stamp Image */}
                      {hasStampImage && (
                        <Image
                          src={signatory.stampImage}
                          style={{ width: 80, height: 80, marginTop: 5, objectFit: 'contain' }}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View>
                <View style={{ marginTop: 20, marginBottom: 3 }}>
                  <Text>____________________</Text>
                </View>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>Anuj Kumar</Text>
                <Text style={{ fontSize: 10 }}>Founder (PHONEME)</Text>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          {/* Footer line: 70% orange, 30% black */}
          <View style={{ flexDirection: 'row', width: '100%' }}>
            <View style={{ width: '70%', height: 3, backgroundColor: '#FF6B35' }} />
            <View style={{ width: '30%', height: 3, backgroundColor: '#000000' }} />
          </View>
          <View style={styles.footerContent}>
            <Text>
              Phoneme Solutions Pvt Ltd. Advant Navis Business Park, B- 614 Sector 142, Noida - 201307 CIN: U74999DL2015PTC275921 GST: 07AAHCP9748G1ZX
            </Text>
            <Text>
              Reg.Off: 1/22, 2nd Floor, Asaf Ali Road, New Delhi-110017 | info@phoneme.com | http://www.myphoneme.com
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
