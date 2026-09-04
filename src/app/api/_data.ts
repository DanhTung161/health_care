export const patients = [
  { id: "p-001", name: "Nguyễn Minh Anh", age: 34, gender: "Nữ", phone: "0901 234 567", diagnosis: "Khám tổng quát" },
  { id: "p-002", name: "Trần Quốc Bảo", age: 51, gender: "Nam", phone: "0902 345 678", diagnosis: "Tim mạch" },
  { id: "p-003", name: "Lê Thu Hà", age: 28, gender: "Nữ", phone: "0903 456 789", diagnosis: "Da liễu" },
];

export const doctors = [
  { id: "d-001", name: "Emily Carter", specialty: "Tim mạch", email: "emily.carter@healthnexus.com", available: true },
  { id: "d-002", name: "Michael Chen", specialty: "Thần kinh", email: "michael.chen@healthnexus.com", available: true },
  { id: "d-003", name: "Sarah Lee", specialty: "Da liễu", email: "sarah.lee@healthnexus.com", available: false },
];

export const appointments = [
  { id: "a-001", patientId: "p-001", doctorId: "d-001", date: "2026-09-04", time: "09:00", status: "confirmed", reason: "Khám tổng quát" },
  { id: "a-002", patientId: "p-002", doctorId: "d-002", date: "2026-09-04", time: "10:30", status: "confirmed", reason: "Tư vấn tim mạch" },
  { id: "a-003", patientId: "p-003", doctorId: "d-003", date: "2026-09-05", time: "13:00", status: "scheduled", reason: "Tái khám da liễu" },
];

export const users = [
  { id: "u-001", name: "Sarah Johnson", email: "sarah.johnson@healthnexus.com", role: "Admin", status: "active", lastLogin: "2026-09-04 08:42" },
  { id: "u-002", name: "Emily Carter", email: "emily.carter@healthnexus.com", role: "Doctor", status: "active", lastLogin: "2026-09-04 08:15" },
  { id: "u-003", name: "David Nguyen", email: "david.nguyen@healthnexus.com", role: "Staff", status: "active", lastLogin: "2026-09-03 17:30" },
];
