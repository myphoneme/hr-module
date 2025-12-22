import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles } from './styles';
import { LOGO_BASE64 } from './logo';

interface OfferLetterTemplateProps {
  letterContent: any;
}

export function OfferLetterTemplate({ letterContent }: OfferLetterTemplateProps) {
  const {
    date,
    to,
    address,
    subject,
    body,
    signature,
    signatory,
    secondarySignatory,
  } = letterContent;

  // Get designation from subject
  const designation = subject?.replace('Offer for the post of ', '') || '';

  return (
    <Document>
      {/* Single Page Offer Letter - Matching Existing Format */}
      <Page size="A4" style={styles.page}>

        {/* Header with black line and logo */}
        <View style={{ marginLeft: -72, marginRight: -72, marginTop: -50 }}>
          <View style={{ height: 4, backgroundColor: '#000000', width: '100%' }} />
          <View style={{ paddingLeft: 72, paddingRight: 72, marginTop: 15 }}>
            <View style={{ marginLeft: -32 }}>
              <Image src={LOGO_BASE64} style={styles.logo} />
            </View>
            {/* Title centered */}
            <View style={{ alignItems: 'center', width: '100%', marginTop: 20, marginBottom: 15 }}>
              <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#E55300', textDecoration: 'underline' }}>
                OFFER LETTER
              </Text>
            </View>
          </View>
        </View>

        {/* Date on right */}
        <View style={{ alignItems: 'flex-end', marginBottom: 15 }}>
          <Text style={{ fontSize: 10 }}>Date: {date}</Text>
        </View>

        {/* To Section */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 10, marginBottom: 2 }}>To,</Text>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{to}</Text>
          <Text style={{ fontSize: 10 }}>{address}</Text>
        </View>

        {/* Subject Line - Orange underlined */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 10, color: '#E55300', textDecoration: 'underline' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Subject: </Text>
            {subject}
          </Text>
        </View>

        {/* Greeting */}
        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 10 }}>Dear {to?.split(' ')[0]},</Text>
        </View>

        {/* Congratulations */}
        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>Congratulations!</Text>
        </View>

        {/* Opening Paragraph */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 10, lineHeight: 1.4 }}>
            This is with reference to your application and subsequent interview held with Phoneme Solutions Pvt. Ltd.. We are pleased to offer you as "{designation}" in our organization on the following terms and conditions.
          </Text>
        </View>

        {/* Section 1: Commencement of Employment */}
        <View style={{ marginBottom: 5 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>
            1. Commencement of Employment:
          </Text>
          <Text style={{ fontSize: 10 }}>
            Your joining date is {body?.joiningDate}.
          </Text>
        </View>

        {/* Section 2: Remuneration */}
        <View style={{ marginBottom: 5 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>
            2. Remuneration:
          </Text>
          <Text style={{ fontSize: 10 }}>
            Your total annual compensation would be INR {body?.ctcFormatted}/- ({body?.ctcInWords}) per annum. CTC Breakup is provided in Annexure A.
          </Text>
        </View>

        {/* Section 3: Place of Work */}
        <View style={{ marginBottom: 5 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>
            3. Place of Work:
          </Text>
          <Text style={{ fontSize: 10 }}>
            Your place of work will be {body?.workingLocation || 'Delhi'}.
          </Text>
        </View>

        {/* Section 4: Working Hours - uses learned content if available */}
        <View style={{ marginBottom: 5 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>
            4. Working Hours:
          </Text>
          <Text style={{ fontSize: 10, lineHeight: 1.3 }}>
            {body?.workingHours?.replace(/^Working Hours:\s*/i, '') ||
              'Your working hours will be 9:00 am to 06:00 pm. As per current company policy, you need to complete 9 hours in a day. The company observes a 5-day work week, with Saturday and Sunday as weekly off.'}
          </Text>
        </View>

        {/* Section 5: Probation Period - uses learned content if available */}
        <View style={{ marginBottom: 5 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>
            5. Probation Period:
          </Text>
          <Text style={{ fontSize: 10, lineHeight: 1.3 }}>
            {body?.probation?.replace(/^Probation.*?:\s*/i, '') ||
              'You will be on probation for six months. Based on your performance, your services will be confirmed with the company in writing after six months.'}
          </Text>
        </View>

        {/* Section 6: Notice Period - uses learned content if available */}
        <View style={{ marginBottom: 5 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>
            6. Notice Period:
          </Text>
          <Text style={{ fontSize: 10, lineHeight: 1.3 }}>
            {body?.notice?.replace(/^Notice Period:\s*/i, '') ||
              'This appointment may be terminated by either side by giving thirty days notice or one month\'s salary in lieu of notice period.'}
          </Text>
        </View>

        {/* Section 7: Confidentiality - uses learned content if available */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>
            7. Confidentiality:
          </Text>
          <Text style={{ fontSize: 10, lineHeight: 1.3 }}>
            {body?.confidentiality?.text ||
              'During your employment with the company and thereafter, you will hold in strictest confidence all proprietary information and trade secrets of the company.'}
          </Text>
        </View>

        {/* Acceptance Deadline */}
        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 10, lineHeight: 1.3 }}>
            Please accept this offer by signing and returning the acceptance copy on or before {body?.offerValidDate}, failing which this offer stands cancelled.
          </Text>
        </View>

        {/* Closing */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 10 }}>
            We welcome you to the Phoneme Solutions family and wish you a successful career with us.
          </Text>
        </View>

        {/* Regards and Signatures */}
        <View>
          <Text style={{ fontSize: 10, marginBottom: 3 }}>Regards,</Text>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 12 }}>For Phoneme Solutions Pvt. Ltd..</Text>

          {/* Two Signatures Side by Side */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {/* Left - HR Manager */}
            <View style={{ width: '45%' }}>
              {signatory?.signature ? (
                <Image
                  src={signatory.signature}
                  style={{ width: 80, height: 40, objectFit: 'contain', marginBottom: 5 }}
                />
              ) : (
                <Text style={{ fontFamily: 'Helvetica-Oblique', fontSize: 14, marginBottom: 5, color: '#1a365d' }}>
                  {signatory?.name || signature?.name}
                </Text>
              )}
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>
                {signatory?.name || signature?.name}
              </Text>
              <Text style={{ fontSize: 10 }}>
                {signatory?.position || signature?.title}
              </Text>
            </View>

            {/* Right - Director */}
            <View style={{ width: '45%', alignItems: 'flex-end' }}>
              {secondarySignatory?.stamp ? (
                <Image
                  src={secondarySignatory.stamp}
                  style={{ width: 60, height: 60, objectFit: 'contain', marginBottom: 3 }}
                />
              ) : secondarySignatory?.signature ? (
                <Image
                  src={secondarySignatory.signature}
                  style={{ width: 80, height: 40, objectFit: 'contain', marginBottom: 5 }}
                />
              ) : (
                <View style={{ height: 40, marginBottom: 5 }} />
              )}
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>
                {secondarySignatory?.name || 'Director'}
              </Text>
              <Text style={{ fontSize: 10 }}>
                {secondarySignatory?.position || 'Director'}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={{ flexDirection: 'row', width: '100%' }}>
            <View style={{ width: '70%', height: 3, backgroundColor: '#FF6B35' }} />
            <View style={{ width: '30%', height: 3, backgroundColor: '#000000' }} />
          </View>
          <View style={styles.footerContent}>
            <Text style={styles.footerText}>
              Phoneme Solutions Pvt Ltd. Advant Navis Business Park, B- 614 Sector 142, Noida - 201307 CIN: U74999DL2015PTC275921 GST: 07AAHCP9748G1ZX
            </Text>
            <Text style={styles.footerText}>
              Reg.Off: 1/22, 2nd Floor, Asaf Ali Road, New Delhi-110017 info@myphoneme.com http://www.myphoneme.com
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
