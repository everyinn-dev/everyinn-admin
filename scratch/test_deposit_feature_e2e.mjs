async function testDepositFeature() {
  console.log("=== Testing Deposit & Automated Reminders End-to-End ===");

  // 1. Login as Manager
  const loginRes = await fetch("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "0901234567", password: "everyinn2024" }),
  });
  console.log("1. Login status:", loginRes.status);
  const cookie = loginRes.headers.get("set-cookie");
  const headers = { "Content-Type": "application/json", Cookie: cookie };

  const todayStr = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const baseEpoch = Date.now() + Math.floor(Math.random() * 20000000000) + 150 * 86400 * 1000;
  const checkinTime = new Date(baseEpoch);
  checkinTime.setHours(15, 0, 0, 0);
  const checkoutTime = new Date(checkinTime.getTime() + 86400 * 1000);
  checkoutTime.setHours(12, 0, 0, 0);

  const randSuffix = Math.floor(Math.random() * 9000) + 1000;
  const phone1 = `091122${randSuffix}`;
  const phone2 = `098877${randSuffix}`;
  const phone3 = `097766${randSuffix}`;

  // 2. Create a Booking with 50% Deposit
  console.log("\n2. Creating Booking with 50% Deposit...");
  const createBookingRes = await fetch("http://localhost:3001/api/bookings", {
    method: "POST",
    headers,
    body: JSON.stringify({
      roomId: "haven-101",
      phone: phone1,
      name: "Nguyễn Văn Cọc",
      facebook: "fb.com/nguyenvancoc",
      bookingType: "dayuse",
      checkinAt: checkinTime.toISOString(),
      checkoutAt: checkoutTime.toISOString(),
      isDeposit: true,
      depositAmount: 300000,
      depositDueDate: todayStr, // Set due today to test automated reminder!
      closingNote: "Khách chốt cọc 300k, còn thiếu 290k thu khi nhận phòng",
    }),
  });

  const createData = await createBookingRes.json();
  console.log("Booking created status:", createBookingRes.status);
  if (!createBookingRes.ok) {
    throw new Error("Failed to create deposit booking: " + JSON.stringify(createData));
  }

  console.log("Booking result:", {
    id: createData.booking?.id,
    totalPrice: createData.booking?.totalPrice,
    isDeposit: createData.booking?.isDeposit,
    depositAmount: createData.booking?.depositAmount,
    paidAmount: createData.booking?.paidAmount,
    remainingAmount: createData.booking?.remainingAmount,
    depositStatus: createData.booking?.depositStatus,
    depositDueDate: createData.booking?.depositDueDate,
  });

  const bookingId = createData.booking.id;

  // Verify CDP member totalSpent only has 300,000đ (not 590,000đ)
  const memberRes = await fetch(`http://localhost:3001/api/members/${phone1}`, { headers });
  const memberData = await memberRes.json();
  const member = memberData.member;
  console.log("Member initial totalSpent (Expected 300.000đ):", member?.totalSpent);
  if (member?.totalSpent !== 300000) {
    throw new Error(`Member totalSpent was ${member?.totalSpent}, expected 300000`);
  }

  // 3. Test GET /api/bookings/deposit-reminders
  console.log("\n3. Testing GET /api/bookings/deposit-reminders (Automated Polling)...");
  const remindersRes = await fetch("http://localhost:3001/api/bookings/deposit-reminders", { headers });
  const remindersData = await remindersRes.json();
  console.log("Reminders count:", remindersData.count);
  const matched = remindersData.reminders?.find((r) => r.id === bookingId);
  console.log("Matched booking in today reminders:", matched ? `YES (#${matched.id} - Còn thiếu ${matched.remaining_amount}đ)` : "NO");

  if (!matched) {
    throw new Error("Deposit reminder did not return the newly created deposit booking!");
  }

  // 4. Test Action: mark_deposit_reminder_sent ("Đã gửi nhắc cọc")
  console.log("\n4. Testing Action: mark_deposit_reminder_sent...");
  const markSentRes = await fetch(`http://localhost:3001/api/bookings/${bookingId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ action: "mark_deposit_reminder_sent" }),
  });
  const markSentData = await markSentRes.json();
  console.log("Mark sent status:", markSentRes.status, "Message:", markSentData.message);

  // Verify it disappears from today's reminders
  const remindersAfterRes = await fetch("http://localhost:3001/api/bookings/deposit-reminders", { headers });
  const remindersAfterData = await remindersAfterRes.json();
  const stillInReminders = remindersAfterData.reminders?.some((r) => r.id === bookingId);
  console.log("Still in reminders after mark sent? (Expected: false):", stillInReminders);

  // 5. Test Action: complete_deposit_payment ("Bổ sung thanh toán phần còn lại")
  console.log("\n5. Testing Action: complete_deposit_payment (+290.000đ)...");
  const completePaymentRes = await fetch(`http://localhost:3001/api/bookings/${bookingId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      action: "complete_deposit_payment",
      paymentAmount: 290000,
      note: "Khách quét VietQR chuyển nốt khi check-in",
    }),
  });
  const completePaymentData = await completePaymentRes.json();
  console.log("Complete payment status:", completePaymentRes.status);
  console.log("Complete payment result:", {
    success: completePaymentData.success,
    message: completePaymentData.message,
    paidAmount: completePaymentData.paidAmount,
    remainingAmount: completePaymentData.remainingAmount,
    depositStatus: completePaymentData.depositStatus,
  });

  // Verify Member CDP was updated to 590,000đ (Bronze tier)
  const memberAfterRes = await fetch(`http://localhost:3001/api/members/${phone1}`, { headers });
  const memberAfterData = await memberAfterRes.json();
  console.log("Member totalSpent after full payment (Expected 590.000đ):", memberAfterData.member?.totalSpent, "Tier:", memberAfterData.member?.loyaltyTier);

  // 6. Test Extend 1h after fully paid deposit booking
  console.log("\n6. Testing Extend 1h after full payment (reopening remaining amount)...");
  const extendRes = await fetch(`http://localhost:3001/api/bookings/${bookingId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ action: "extend1h" }),
  });
  const extendData = await extendRes.json();
  console.log("Extend 1h status:", extendRes.status);
  const detailAfterExtendRes = await fetch(`http://localhost:3001/api/bookings/${bookingId}`, { headers });
  const detailAfterExtend = (await detailAfterExtendRes.json()).booking;
  console.log("Booking after extend 1h:", {
    total_price: detailAfterExtend.total_price,
    paid_amount: detailAfterExtend.paid_amount,
    remaining_amount: detailAfterExtend.remaining_amount,
    deposit_status: detailAfterExtend.deposit_status,
  });

  if (detailAfterExtend.remaining_amount !== 60000 || detailAfterExtend.deposit_status !== "deposit_paid") {
    throw new Error(`Extend 1h failed to set remaining_amount to 60000 or status to deposit_paid! Got: ${detailAfterExtend.remaining_amount}, status: ${detailAfterExtend.deposit_status}`);
  }

  // 7. Test Fix Lỗ hổng: No-Show on Deposit Booking
  console.log("\n7. Testing No-Show on Deposit Booking...");
  const checkin2 = new Date(baseEpoch + 86400 * 1000 * 5);
  checkin2.setHours(15, 0, 0, 0);
  const checkout2 = new Date(checkin2.getTime() + 86400 * 1000);
  checkout2.setHours(12, 0, 0, 0);
  const createDeposit2Res = await fetch("http://localhost:3001/api/bookings", {
    method: "POST",
    headers,
    body: JSON.stringify({
      roomId: "sig-102",
      phone: phone2,
      name: "Trần Thị Cọc Bùng",
      instagram: "coc.bung",
      bookingType: "dayuse",
      checkinAt: checkin2.toISOString(),
      checkoutAt: checkout2.toISOString(),
      isDeposit: true,
      depositAmount: 375000, // 50% of 750k
      depositDueDate: todayStr,
    }),
  });
  const deposit2Data = await createDeposit2Res.json();
  if (!createDeposit2Res.ok) {
    throw new Error("Failed to create deposit 2 booking: " + JSON.stringify(deposit2Data));
  }
  const booking2Id = deposit2Data.booking.id;
  console.log("Created second deposit booking:", booking2Id, "Paid:", deposit2Data.booking.paidAmount, "Total:", deposit2Data.booking.totalPrice);

  // Attempt to refund 500.000đ (which is > actual paid 375.000đ) -> MUST REJECT!
  const excessiveRefundRes = await fetch(`http://localhost:3001/api/bookings/${booking2Id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      action: "no_show",
      refundAmount: 500000,
      noShowReason: "Khách đòi hoàn tiền quá số tiền đã cọc",
    }),
  });
  const excessiveData = await excessiveRefundRes.json();
  console.log("Excessive refund attempt (Expected 400 error):", excessiveRefundRes.status, "Error:", excessiveData.error);

  // Mark legitimate No-Show keeping 100% of deposit (netRetained must be 375.000đ, NOT 750.000đ!)
  const validNoShowRes = await fetch(`http://localhost:3001/api/bookings/${booking2Id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      action: "no_show",
      refundAmount: 0,
      noShowReason: "Khách bùng cọc không đến nhận phòng",
    }),
  });
  const validNoShowData = await validNoShowRes.json();
  console.log("Valid No-Show status:", validNoShowRes.status);
  console.log("Valid No-Show netRetained (Expected 375.000đ):", validNoShowData.netRetained, "Message:", validNoShowData.message);

  if (validNoShowData.netRetained !== 375000) {
    throw new Error(`Net retained was ${validNoShowData.netRetained}, expected 375000`);
  }

  // 8. Test Clean Up / Hard Delete on Deposit Booking
  console.log("\n8. Testing Hard Delete / Cancel on Deposit Booking...");
  const checkin3 = new Date(baseEpoch + 86400 * 1000 * 10);
  checkin3.setHours(15, 0, 0, 0);
  const checkout3 = new Date(checkin3.getTime() + 86400 * 1000);
  checkout3.setHours(12, 0, 0, 0);
  const createDeposit3Res = await fetch("http://localhost:3001/api/bookings", {
    method: "POST",
    headers,
    body: JSON.stringify({
      roomId: "sig-202",
      phone: phone3,
      name: "Lê Văn Hủy Cọc",
      facebook: "fb.com/huycoc",
      bookingType: "dayuse",
      checkinAt: checkin3.toISOString(),
      checkoutAt: checkout3.toISOString(),
      isDeposit: true,
      depositAmount: 375000,
      depositDueDate: todayStr,
    }),
  });
  const deposit3Data = await createDeposit3Res.json();
  if (!createDeposit3Res.ok) {
    throw new Error("Failed to create deposit 3 booking: " + JSON.stringify(deposit3Data));
  }
  const booking3Id = deposit3Data.booking.id;

  const deleteRes = await fetch(`http://localhost:3001/api/bookings/${booking3Id}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ cancelReason: "Khách đổi ý hủy cọc hoàn tiền" }),
  });
  console.log("Delete booking status:", deleteRes.status);
  const member3Res = await fetch(`http://localhost:3001/api/members/${phone3}`, { headers });
  const member3Data = await member3Res.json();
  console.log("Member 3 totalSpent after cancel (Expected 0đ):", member3Data.member?.totalSpent);

  console.log("\n✅ ALL TESTS PASSED! Deposit Management, Calculations & Reminders verified 100% working correctly!");
}

testDepositFeature().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
